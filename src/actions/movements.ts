'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { MovementType, DocStatus } from '@/generated/prisma'
import { serialize } from '@/lib/serialize'
import type { ActionResult, PaginatedResult, MovementWithRelations } from '@/types'
import { sendLineMovementPosted, sendLineMovementPending, sendLineNotificationToUser } from '@/actions/line-notifications'
import { createNotification } from '@/actions/notifications'
import { 
  getUserEnabledChannels,
  getUserLineId,
  type NotificationTypeKey 
} from '@/actions/user-notification-preferences'

interface MovementLineInput {
  productId: string
  variantId?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost?: number
  note?: string
  lotId?: string
  newLotNumber?: string
  newLotExpiryDate?: string
}

interface CreateMovementInput {
  type: MovementType
  note?: string
  reason?: string
  projectCode?: string
  refType?: string
  refId?: string
  lines: MovementLineInput[]
}

async function generateDocNumber(type: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.docSequence.update({
      where: { docType: type === 'MOVEMENT' ? 'MOVEMENT' : type },
      data: { currentNo: { increment: 1 } },
    })

    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const num = sequence.currentNo.toString().padStart(sequence.padLength, '0')

    return `${sequence.prefix}${year}${month}-${num}`
  })

  return result
}

export async function getMovements(params: {
  page?: number
  limit?: number
  type?: MovementType
  status?: DocStatus
  search?: string
  dateFrom?: string
  dateTo?: string
}): Promise<PaginatedResult<MovementWithRelations>> {
  const { page = 1, limit = 20, type, status, search, dateFrom, dateTo } = params

  const where = {
    ...(type && { type }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { docNumber: { contains: search, mode: 'insensitive' as const } },
        { note: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...((dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + 'T23:59:59.999Z') }),
      },
    }),
  }

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        approvedBy: {
          select: { id: true, name: true },
        },
        lines: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            qty: true,
            product: {
              select: { id: true, name: true, sku: true },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
                optionValues: {
                  select: {
                    optionValue: {
                      select: {
                        value: true,
                        optionType: { select: { name: true } },
                      },
                    },
                  },
                  orderBy: {
                    optionValue: {
                      optionType: { displayOrder: 'asc' },
                    },
                  },
                },
              },
            },
            fromLocation: {
              select: {
                id: true, name: true, code: true,
                warehouse: { select: { id: true, name: true } },
              },
            },
            toLocation: {
              select: {
                id: true, name: true, code: true,
                warehouse: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ])

  return {
    items: serialize(items) as MovementWithRelations[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getMovement(id: string): Promise<MovementWithRelations | null> {
  const movement = await prisma.stockMovement.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, username: true, role: true },
      },
      approvedBy: {
        select: { id: true, name: true, username: true, role: true },
      },
      lines: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true, standardCost: true },
          },
          variant: {
            select: { id: true, name: true, sku: true, barcode: true },
          },
          fromLocation: {
            select: {
              id: true, name: true, code: true,
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
          toLocation: {
            select: {
              id: true, name: true, code: true,
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
    },
  })

  if (!movement) return null

  // Convert Decimal to Number for client components
  return serialize(movement) as MovementWithRelations
}

export async function createMovement(data: CreateMovementInput): Promise<ActionResult<MovementWithRelations>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!data.lines || data.lines.length === 0) {
    return { success: false, error: 'กรุณาเพิ่มรายการสินค้า' }
  }

  try {
    const docNumber = await generateDocNumber('MOVEMENT')

    // Create new lots first (for RECEIVE type with newLotNumber)
    const lotIdMap = new Map<number, string>() // lineIndex -> lotId
    
    if (data.type === 'RECEIVE') {
      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i]
        if (line.newLotNumber && !line.lotId) {
          // Check if lot already exists
          const existingLot = await prisma.lot.findFirst({
            where: {
              lotNumber: line.newLotNumber,
              productId: line.productId,
            },
          })

          if (existingLot) {
            // Use existing lot
            lotIdMap.set(i, existingLot.id)
          } else {
            // Create new lot
            const newLot = await prisma.lot.create({
              data: {
                lotNumber: line.newLotNumber,
                productId: line.productId,
                variantId: line.variantId || null,
                expiryDate: line.newLotExpiryDate ? new Date(line.newLotExpiryDate) : null,
                qtyReceived: line.qty,
              },
            })
            lotIdMap.set(i, newLot.id)
          }
        }
      }
    }

    const movement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: data.type,
        status: DocStatus.DRAFT,
        note: data.note,
        reason: data.reason,
        projectCode: data.projectCode,
        refType: data.refType,
        refId: data.refId,
        createdById: session.id,
        lines: {
          create: data.lines.map((line, index) => {
            const lotId = line.lotId || lotIdMap.get(index)
            return {
              productId: line.productId,
              variantId: line.variantId || null,
              fromLocationId: line.fromLocationId || null,
              toLocationId: line.toLocationId || null,
              qty: line.qty,
              unitCost: line.unitCost || 0,
              note: line.note,
              // Create LotMovementLine if lotId is provided
              ...(lotId && {
                lotMovementLines: {
                  create: {
                    lotId: lotId,
                    qty: line.qty,
                  },
                },
              }),
            }
          }),
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true, supabaseId: true, customPermissions: true },
        },
        approvedBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true, supabaseId: true, customPermissions: true },
        },
        lines: {
          include: {
            product: true,
            fromLocation: { include: { warehouse: true } },
            toLocation: { include: { warehouse: true } },
          },
        },
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'MOVEMENT',
        refId: movement.id,
        newData: { docNumber, type: data.type },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    return { success: true, data: movement as unknown as MovementWithRelations }
  } catch (error) {
    console.error('Create movement error:', error)
    return { success: false, error: 'ไม่สามารถสร้างรายการเคลื่อนไหวได้' }
  }
}

export async function submitMovement(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    // Allow submit for DRAFT and REJECTED status (can be resubmitted for approval)
    if (movement.status !== DocStatus.DRAFT && movement.status !== DocStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถส่งรายการที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    if (movement.lines.length === 0) {
      return { success: false, error: 'กรุณาเพิ่มรายการสินค้าก่อนส่ง' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: { status: DocStatus.SUBMITTED },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'SUBMIT',
        refType: 'MOVEMENT',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    // Send notifications to approvers
    notifyMovementSubmitted(id, movement.docNumber, movement.type, session.name).catch((err) =>
      console.error('Failed to send movement submission notifications:', err)
    )

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Submit movement error:', error)
    return { success: false, error: 'ไม่สามารถส่งรายการได้' }
  }
}

export async function approveMovement(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถอนุมัติรายการที่ไม่ใช่ Submitted ได้' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: {
        status: DocStatus.APPROVED,
        approvedById: session.id,
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'APPROVE',
        refType: 'MOVEMENT',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Approve movement error:', error)
    return { success: false, error: 'ไม่สามารถอนุมัติรายการได้' }
  }
}

export async function postMovement(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUnique({
        where: { id },
        include: {
          lines: {
            include: { 
              product: true,
              variant: true,
              lotMovementLines: {
                include: { lot: true },
              },
            },
          },
        },
      })

      if (!movement) {
        throw new Error('ไม่พบรายการ')
      }

      if (movement.status !== DocStatus.APPROVED) {
        throw new Error('ไม่สามารถ Post รายการที่ยังไม่อนุมัติได้')
      }

      // Helper function to find or create stock balance
      async function getStockBalance(productId: string, variantId: string | null, locationId: string) {
        return tx.stockBalance.findFirst({
          where: {
            productId,
            variantId: variantId || null,
            locationId,
          },
        })
      }

      async function incrementStock(productId: string, variantId: string | null, locationId: string, qty: number) {
        const existing = await getStockBalance(productId, variantId, locationId)
        if (existing) {
          await tx.stockBalance.update({
            where: { id: existing.id },
            data: { qtyOnHand: { increment: qty } },
          })
        } else {
          await tx.stockBalance.create({
            data: {
              productId,
              variantId: variantId || null,
              locationId,
              qtyOnHand: qty,
            },
          })
        }
      }

      async function decrementStock(productId: string, variantId: string | null, locationId: string, qty: number, productName: string) {
        const existing = await getStockBalance(productId, variantId, locationId)
        const currentQty = Number(existing?.qtyOnHand ?? 0)
        if (currentQty < qty) {
          throw new Error(`สินค้า ${productName} มีไม่เพียงพอ (มี ${currentQty}, ต้องการ ${qty})`)
        }
        if (existing) {
          await tx.stockBalance.update({
            where: { id: existing.id },
            data: { qtyOnHand: { decrement: qty } },
          })
        }
      }

      // Lot balance helpers
      async function incrementLotBalance(lotId: string, locationId: string, qty: number) {
        const existing = await tx.lotBalance.findFirst({
          where: { lotId, locationId },
        })
        if (existing) {
          await tx.lotBalance.update({
            where: { lotId_locationId: { lotId, locationId } },
            data: { qtyOnHand: { increment: qty } },
          })
        } else {
          await tx.lotBalance.create({
            data: { lotId, locationId, qtyOnHand: qty },
          })
        }
      }

      async function decrementLotBalance(lotId: string, locationId: string, qty: number, lotNumber: string) {
        const existing = await tx.lotBalance.findFirst({
          where: { lotId, locationId },
        })
        const currentQty = Number(existing?.qtyOnHand ?? 0)
        if (currentQty < qty) {
          throw new Error(`Lot ${lotNumber} มีไม่เพียงพอ (มี ${currentQty}, ต้องการ ${qty})`)
        }
        if (existing) {
          await tx.lotBalance.update({
            where: { lotId_locationId: { lotId, locationId } },
            data: { qtyOnHand: { decrement: qty } },
          })
        }
      }

      // Update stock balances based on movement type
      for (const line of movement.lines) {
        const qty = Number(line.qty)
        const variantId = line.variantId || null
        const productName = line.variant 
          ? `${line.product.name} (${line.variant.sku})`
          : line.product.name
        
        // Get lot info if exists
        const lotMovement = line.lotMovementLines[0]
        const lotId = lotMovement?.lotId
        const lotNumber = lotMovement?.lot?.lotNumber

        switch (movement.type) {
          case MovementType.RECEIVE:
            // Increase stock at destination
            if (line.toLocationId) {
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
              // Update lot balance if lot is specified
              if (lotId) {
                await incrementLotBalance(lotId, line.toLocationId, qty)
              }
            }
            break

          case MovementType.ISSUE:
            // Decrease stock at source
            if (line.fromLocationId) {
              await decrementStock(line.productId, variantId, line.fromLocationId, qty, productName)
              // Update lot balance if lot is specified
              if (lotId && lotNumber) {
                await decrementLotBalance(lotId, line.fromLocationId, qty, lotNumber)
              }
            }
            break

          case MovementType.TRANSFER:
            // Decrease from source, increase at destination
            if (line.fromLocationId && line.toLocationId) {
              await decrementStock(line.productId, variantId, line.fromLocationId, qty, productName)
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
              // Update lot balance if lot is specified
              if (lotId && lotNumber) {
                await decrementLotBalance(lotId, line.fromLocationId, qty, lotNumber)
                await incrementLotBalance(lotId, line.toLocationId, qty)
              }
            }
            break

          case MovementType.ADJUST:
            // Adjust stock: positive qty = add, negative qty = subtract
            if (line.toLocationId) {
              if (qty >= 0) {
                await incrementStock(line.productId, variantId, line.toLocationId, qty)
                if (lotId) {
                  await incrementLotBalance(lotId, line.toLocationId, qty)
                }
              } else {
                // qty is negative, decrement by absolute value
                await decrementStock(line.productId, variantId, line.toLocationId, Math.abs(qty), productName)
                if (lotId && lotNumber) {
                  await decrementLotBalance(lotId, line.toLocationId, Math.abs(qty), lotNumber)
                }
              }
            }
            break

          case MovementType.RETURN:
            // Increase stock at destination (return to stock)
            if (line.toLocationId) {
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
              if (lotId) {
                await incrementLotBalance(lotId, line.toLocationId, qty)
              }
            }
            break
        }
      }

      // Update movement status
      await tx.stockMovement.update({
        where: { id },
        data: {
          status: DocStatus.POSTED,
          postedAt: new Date(),
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: session.id,
          action: 'POST',
          refType: 'MOVEMENT',
          refId: id,
        },
      })

      return movement
    }, {
      timeout: 30000, // 30 seconds - การ post movement หลายรายการอาจใช้เวลานาน
      maxWait: 10000,
    })

    // Send notifications based on user preferences
    notifyMovementPosted(id, result.docNumber, result.type, result.createdById).catch((err) =>
      console.error('Failed to send movement posted notifications:', err)
    )

    // Also send LINE to global recipients
    sendLineMovementPosted(id).catch((err) =>
      console.error('Failed to send movement posted notification:', err)
    )

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    revalidatePath('/stock')
    revalidatePath('/dashboard')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Post movement error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'ไม่สามารถ Post รายการได้' }
  }
}

export async function rejectMovement(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถปฏิเสธรายการที่ไม่ใช่ Submitted ได้' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: {
        status: DocStatus.REJECTED,
        note: reason ? `${movement.note || ''}\n[ปฏิเสธ] ${reason}` : movement.note,
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'REJECT',
        refType: 'MOVEMENT',
        refId: id,
        newData: { reason },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Reject movement error:', error)
    return { success: false, error: 'ไม่สามารถปฏิเสธรายการได้' }
  }
}

interface UpdateMovementLineInput {
  id?: string
  productId: string
  variantId?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost?: number
  note?: string
}

interface UpdateMovementInput {
  note?: string
  reason?: string
  projectCode?: string
  lines: UpdateMovementLineInput[]
}

export async function updateMovement(id: string, data: UpdateMovementInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    // Allow editing for DRAFT and REJECTED status (can be resubmitted for approval)
    if (movement.status !== DocStatus.DRAFT && movement.status !== DocStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถแก้ไขรายการที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    // Delete old lines
    await prisma.movementLine.deleteMany({
      where: { movementId: id },
    })

    // Update movement and create new lines
    await prisma.stockMovement.update({
      where: { id },
      data: {
        note: data.note,
        reason: data.reason,
        projectCode: data.projectCode,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId || null,
            fromLocationId: line.fromLocationId || null,
            toLocationId: line.toLocationId || null,
            qty: line.qty,
            unitCost: line.unitCost || 0,
            note: line.note,
          })),
        },
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'MOVEMENT',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    revalidatePath(`/movements/${id}/edit`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update movement error:', error)
    return { success: false, error: 'ไม่สามารถแก้ไขรายการได้' }
  }
}

export async function cancelMovement(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status === DocStatus.POSTED) {
      return { success: false, error: 'ไม่สามารถยกเลิกรายการที่ Post แล้วได้' }
    }

    if (movement.status === DocStatus.CANCELLED) {
      return { success: false, error: 'รายการนี้ถูกยกเลิกแล้ว' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: {
        status: DocStatus.CANCELLED,
        note: reason ? `${movement.note || ''}\n[ยกเลิก] ${reason}` : movement.note,
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CANCEL',
        refType: 'MOVEMENT',
        refId: id,
        newData: { reason },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Cancel movement error:', error)
    return { success: false, error: 'ไม่สามารถยกเลิกรายการได้' }
  }
}

/**
 * Reverse a posted movement - creates a new movement that reverses the stock changes
 */
export async function reverseMovement(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            variant: true,
            lotMovementLines: true,
          },
        },
      },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.POSTED) {
      return { success: false, error: 'สามารถกลับรายการได้เฉพาะเอกสารที่ Post แล้วเท่านั้น' }
    }

    // Check if already reversed
    const existingReversal = await prisma.stockMovement.findFirst({
      where: {
        refType: 'REVERSAL',
        refId: id,
        status: { notIn: [DocStatus.CANCELLED, DocStatus.REJECTED] },
      },
    })

    if (existingReversal) {
      return { success: false, error: 'รายการนี้ถูกกลับรายการแล้ว' }
    }

    // Determine reverse type
    let reverseType: MovementType
    switch (movement.type) {
      case MovementType.RECEIVE:
        reverseType = MovementType.ISSUE
        break
      case MovementType.ISSUE:
        reverseType = MovementType.RECEIVE
        break
      case MovementType.TRANSFER:
        reverseType = MovementType.TRANSFER
        break
      case MovementType.ADJUST:
        reverseType = MovementType.ADJUST
        break
      case MovementType.RETURN:
        reverseType = MovementType.ISSUE
        break
      default:
        reverseType = MovementType.ADJUST
    }

    const docNumber = await generateDocNumber('MOVEMENT')

    // Create reversed movement
    const reversedMovement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: reverseType,
        status: DocStatus.DRAFT,
        refType: 'REVERSAL',
        refId: id,
        note: `กลับรายการจาก ${movement.docNumber}`,
        reason: 'กลับรายการ (Reversal)',
        projectCode: movement.projectCode,
        createdById: session.id,
        lines: {
          create: movement.lines.map((line) => {
            // For TRANSFER reversal, swap from and to locations
            const isTransfer = movement.type === MovementType.TRANSFER
            const fromLocationId = isTransfer ? line.toLocationId : line.fromLocationId
            const toLocationId = isTransfer ? line.fromLocationId : line.toLocationId

            // For ADJUST reversal, negate the qty
            const qty = movement.type === MovementType.ADJUST ? -Number(line.qty) : Number(line.qty)

            return {
              productId: line.productId,
              variantId: line.variantId || null,
              fromLocationId: reverseType === MovementType.ISSUE || reverseType === MovementType.TRANSFER 
                ? (fromLocationId || line.toLocationId) 
                : null,
              toLocationId: reverseType === MovementType.RECEIVE || reverseType === MovementType.TRANSFER 
                ? (toLocationId || line.fromLocationId) 
                : null,
              qty,
              unitCost: Number(line.unitCost),
              note: `กลับรายการจาก line: ${line.id}`,
              // Copy lot information if exists
              ...(line.lotMovementLines[0] && {
                lotMovementLines: {
                  create: {
                    lotId: line.lotMovementLines[0].lotId,
                    qty,
                  },
                },
              }),
            }
          }),
        },
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE_REVERSAL',
        refType: 'MOVEMENT',
        refId: reversedMovement.id,
        newData: { originalMovementId: id, originalDocNumber: movement.docNumber },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)

    return { success: true, data: { id: reversedMovement.id } }
  } catch (error) {
    console.error('Reverse movement error:', error)
    return { success: false, error: 'ไม่สามารถกลับรายการได้' }
  }
}

interface ReturnLineInput {
  lineId: string
  qty: number
}

/**
 * Create a RETURN movement from a posted ISSUE movement
 */
export async function createReturnFromIssue(
  issueId: string,
  returnLines: ReturnLineInput[]
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!returnLines || returnLines.length === 0) {
    return { success: false, error: 'กรุณาระบุรายการที่ต้องการคืน' }
  }

  try {
    const issueMovement = await prisma.stockMovement.findUnique({
      where: { id: issueId },
      include: {
        lines: {
          include: {
            product: true,
            variant: true,
            fromLocation: true,
            lotMovementLines: true,
          },
        },
      },
    })

    if (!issueMovement) {
      return { success: false, error: 'ไม่พบรายการเบิกออก' }
    }

    if (issueMovement.type !== MovementType.ISSUE) {
      return { success: false, error: 'สามารถสร้างรายการคืนได้จากรายการเบิกออกเท่านั้น' }
    }

    if (issueMovement.status !== DocStatus.POSTED) {
      return { success: false, error: 'สามารถสร้างรายการคืนได้จากรายการที่ Post แล้วเท่านั้น' }
    }

    // Validate return quantities
    for (const returnLine of returnLines) {
      const originalLine = issueMovement.lines.find(l => l.id === returnLine.lineId)
      if (!originalLine) {
        return { success: false, error: `ไม่พบรายการที่ต้องการคืน: ${returnLine.lineId}` }
      }
      if (returnLine.qty <= 0) {
        return { success: false, error: 'จำนวนที่คืนต้องมากกว่า 0' }
      }
      if (returnLine.qty > Number(originalLine.qty)) {
        return { success: false, error: `จำนวนที่คืนมากกว่าจำนวนที่เบิก (${originalLine.product.name})` }
      }
    }

    const docNumber = await generateDocNumber('MOVEMENT')

    // Create RETURN movement
    const returnMovement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: MovementType.RETURN,
        status: DocStatus.DRAFT,
        refType: 'RETURN_FROM',
        refId: issueId,
        note: `คืนของจาก ${issueMovement.docNumber}`,
        reason: 'คืนสินค้าจากการเบิก',
        projectCode: issueMovement.projectCode,
        createdById: session.id,
        lines: {
          create: returnLines.map((returnLine) => {
            const originalLine = issueMovement.lines.find(l => l.id === returnLine.lineId)!
            
            return {
              productId: originalLine.productId,
              variantId: originalLine.variantId || null,
              // Return goes TO the location it was issued FROM
              toLocationId: originalLine.fromLocationId,
              qty: returnLine.qty,
              unitCost: Number(originalLine.unitCost),
              note: `คืนจาก line: ${originalLine.id}`,
              // Copy lot information if exists
              ...(originalLine.lotMovementLines[0] && {
                lotMovementLines: {
                  create: {
                    lotId: originalLine.lotMovementLines[0].lotId,
                    qty: returnLine.qty,
                  },
                },
              }),
            }
          }),
        },
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE_RETURN',
        refType: 'MOVEMENT',
        refId: returnMovement.id,
        newData: { issueMovementId: issueId, issueDocNumber: issueMovement.docNumber },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${issueId}`)

    return { success: true, data: { id: returnMovement.id } }
  } catch (error) {
    console.error('Create return from issue error:', error)
    return { success: false, error: 'ไม่สามารถสร้างรายการคืนได้' }
  }
}

/**
 * Get linked movements (returns, reversals) for a movement
 */
export async function getLinkedMovements(id: string) {
  try {
    const linkedMovements = await prisma.stockMovement.findMany({
      where: {
        refId: id,
        status: { notIn: [DocStatus.CANCELLED] },
      },
      select: {
        id: true,
        docNumber: true,
        type: true,
        status: true,
        refType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Also get the original movement if this is a linked one
    const currentMovement = await prisma.stockMovement.findUnique({
      where: { id },
      select: { refType: true, refId: true },
    })

    let originalMovement = null
    if (currentMovement?.refId) {
      originalMovement = await prisma.stockMovement.findUnique({
        where: { id: currentMovement.refId },
        select: {
          id: true,
          docNumber: true,
          type: true,
          status: true,
          createdAt: true,
        },
      })
    }

    return {
      success: true,
      data: {
        linkedMovements,
        originalMovement,
        refType: currentMovement?.refType,
      },
    }
  } catch (error) {
    console.error('Get linked movements error:', error)
    return { success: false, error: 'ไม่สามารถโหลดรายการที่เชื่อมโยงได้' }
  }
}

// ============================================
// Notification Helpers
// ============================================

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  RECEIVE: 'รับเข้า',
  ISSUE: 'เบิกออก',
  TRANSFER: 'โอนย้าย',
  ADJUST: 'ปรับปรุง',
  RETURN: 'คืนของ',
}

/**
 * Send notifications to all approvers when a movement is submitted
 * Respects user notification preferences for each channel
 */
async function notifyMovementSubmitted(
  movementId: string, 
  docNumber: string, 
  type: string, 
  submitterName: string
) {
  const typeLabel = MOVEMENT_TYPE_LABELS[type] || type
  const notificationType: NotificationTypeKey = 'movementPending'

  // Get all approvers (ADMIN and APPROVER roles)
  const approvers = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'APPROVER'] },
    },
    select: { id: true },
  })

  // Create notifications based on user preferences
  const notificationPromises = approvers.map(async (approver) => {
    const channels = await getUserEnabledChannels(approver.id, notificationType)
    const tasks: Promise<unknown>[] = []

    // Web notification
    if (channels.web) {
      tasks.push(
        createNotification({
          userId: approver.id,
          type: 'system',
          title: `${typeLabel}รอดำเนินการ: ${docNumber}`,
          message: `${submitterName} ส่งรายการ${typeLabel} ${docNumber} รอดำเนินการ`,
          url: `/movements/${movementId}`,
        })
      )
    }

    // LINE notification (individual)
    if (channels.line) {
      const lineUserId = await getUserLineId(approver.id)
      if (lineUserId) {
        tasks.push(sendLineNotificationToUser(lineUserId, 'movementPending', {
          movementId,
          docNumber,
          type: typeLabel,
          requesterName: submitterName,
        }))
      }
    }

    return Promise.allSettled(tasks)
  })

  // Also send LINE to global recipients
  const linePromise = sendLineMovementPending(movementId).catch((err) =>
    console.error('Failed to send LINE movement pending notification:', err)
  )

  // Execute all in parallel
  await Promise.allSettled([...notificationPromises, linePromise])
}

/**
 * Send notifications when a movement is posted
 * Respects user notification preferences
 */
async function notifyMovementPosted(
  movementId: string,
  docNumber: string,
  type: string,
  creatorId: string
) {
  const typeLabel = MOVEMENT_TYPE_LABELS[type] || type
  const notificationType: NotificationTypeKey = 'movementPosted'
  const channels = await getUserEnabledChannels(creatorId, notificationType)
  const tasks: Promise<unknown>[] = []

  // Web notification
  if (channels.web) {
    tasks.push(
      createNotification({
        userId: creatorId,
        type: 'system',
        title: `${typeLabel} Posted: ${docNumber}`,
        message: `รายการ${typeLabel} ${docNumber} ถูก Post แล้ว`,
        url: `/movements/${movementId}`,
      })
    )
  }

  // LINE notification (individual)
  if (channels.line) {
    const lineUserId = await getUserLineId(creatorId)
    if (lineUserId) {
      tasks.push(sendLineNotificationToUser(lineUserId, 'movementPosted', {
        movementId,
        docNumber,
        type: typeLabel,
      }))
    }
  }

  await Promise.allSettled(tasks)
}
