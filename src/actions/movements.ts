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

    // Create new lots first (for RECEIVE type with newLotNumber) - Optimized with batching
    const lotIdMap = new Map<number, string>() // lineIndex -> lotId
    
    if (data.type === 'RECEIVE') {
      // Collect all lines that need lot handling
      const linesWithNewLot = data.lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.newLotNumber && !line.lotId)

      if (linesWithNewLot.length > 0) {
        // Batch load existing lots
        const lotKeys = linesWithNewLot.map(({ line }) => ({
          lotNumber: line.newLotNumber!,
          productId: line.productId,
        }))

        const existingLots = await prisma.lot.findMany({
          where: {
            OR: lotKeys.map(k => ({
              lotNumber: k.lotNumber,
              productId: k.productId,
            })),
          },
        })

        // Create a map for quick lookup
        const existingLotMap = new Map(
          existingLots.map(lot => [`${lot.productId}:${lot.lotNumber}`, lot.id])
        )

        // Separate lines into those with existing lots and those needing new lots
        const linesToCreateLot: Array<{
          index: number
          lotNumber: string
          productId: string
          variantId: string | null
          expiryDate: Date | null
          qty: number
        }> = []

        for (const { line, index } of linesWithNewLot) {
          const key = `${line.productId}:${line.newLotNumber}`
          const existingLotId = existingLotMap.get(key)
          
          if (existingLotId) {
            lotIdMap.set(index, existingLotId)
          } else {
            linesToCreateLot.push({
              index,
              lotNumber: line.newLotNumber!,
              productId: line.productId,
              variantId: line.variantId || null,
              expiryDate: line.newLotExpiryDate ? new Date(line.newLotExpiryDate) : null,
              qty: line.qty,
            })
          }
        }

        // Create all new lots (need to do sequentially to get IDs back, but faster than before)
        if (linesToCreateLot.length > 0) {
          // Use createMany for efficiency, then fetch the created lots
          const uniqueLotsToCreate = new Map<string, typeof linesToCreateLot[0]>()
          for (const lot of linesToCreateLot) {
            const key = `${lot.productId}:${lot.lotNumber}`
            if (!uniqueLotsToCreate.has(key)) {
              uniqueLotsToCreate.set(key, lot)
            }
          }

          await prisma.lot.createMany({
            data: [...uniqueLotsToCreate.values()].map(lot => ({
              lotNumber: lot.lotNumber,
              productId: lot.productId,
              variantId: lot.variantId,
              expiryDate: lot.expiryDate,
              qtyReceived: lot.qty,
            })),
            skipDuplicates: true,
          })

          // Fetch the newly created lots
          const newLots = await prisma.lot.findMany({
            where: {
              OR: [...uniqueLotsToCreate.values()].map(lot => ({
                lotNumber: lot.lotNumber,
                productId: lot.productId,
              })),
            },
          })

          // Map the new lots back to line indices
          const newLotMap = new Map(
            newLots.map(lot => [`${lot.productId}:${lot.lotNumber}`, lot.id])
          )

          for (const lot of linesToCreateLot) {
            const key = `${lot.productId}:${lot.lotNumber}`
            const lotId = newLotMap.get(key)
            if (lotId) {
              lotIdMap.set(lot.index, lotId)
            }
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

// Map MovementType to notification key prefix for granular notifications
const MOVEMENT_NOTIFICATION_PREFIX: Record<string, string> = {
  RECEIVE: 'receive',
  ISSUE: 'issue',
  TRANSFER: 'transfer',
  ADJUST: 'adjust',
  RETURN: 'return',
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
  // Use granular notification type based on movement type (e.g., 'receivePending', 'issuePending')
  const prefix = MOVEMENT_NOTIFICATION_PREFIX[type] || 'receive'
  const notificationType = `${prefix}Pending` as NotificationTypeKey

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
        tasks.push(sendLineNotificationToUser(lineUserId, notificationType, {
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
  // Use granular notification type based on movement type (e.g., 'receivePosted', 'issuePosted')
  const prefix = MOVEMENT_NOTIFICATION_PREFIX[type] || 'receive'
  const notificationType = `${prefix}Posted` as NotificationTypeKey
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
      tasks.push(sendLineNotificationToUser(lineUserId, notificationType, {
        movementId,
        docNumber,
        type: typeLabel,
      }))
    }
  }

  await Promise.allSettled(tasks)
}

/**
 * Get movements by variant (or product if no variant)
 * Used for showing movement history in product detail page
 */
export async function getMovementsByVariant(params: {
  productId: string
  variantId?: string | null
  page?: number
  limit?: number
  dateFrom?: string
  dateTo?: string
}): Promise<PaginatedResult<{
  id: string
  docNumber: string
  type: MovementType
  status: DocStatus
  qty: number
  fromLocation: { id: string; code: string; warehouseName: string } | null
  toLocation: { id: string; code: string; warehouseName: string } | null
  note: string | null
  createdAt: Date
  postedAt: Date | null
  createdBy: { id: string; name: string }
}>> {
  const { productId, variantId, page = 1, limit = 10, dateFrom, dateTo } = params

  const where = {
    productId,
    variantId: variantId || null,
    movement: {
      status: DocStatus.POSTED,
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + 'T23:59:59.999Z') }),
        },
      }),
    },
  }

  const [lines, total] = await Promise.all([
    prisma.movementLine.findMany({
      where,
      include: {
        movement: {
          select: {
            id: true,
            docNumber: true,
            type: true,
            status: true,
            note: true,
            createdAt: true,
            postedAt: true,
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
        fromLocation: {
          select: {
            id: true,
            code: true,
            warehouse: { select: { name: true } },
          },
        },
        toLocation: {
          select: {
            id: true,
            code: true,
            warehouse: { select: { name: true } },
          },
        },
      },
      orderBy: {
        movement: { createdAt: 'desc' },
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.movementLine.count({ where }),
  ])

  const items = lines.map((line) => ({
    id: line.movement.id,
    docNumber: line.movement.docNumber,
    type: line.movement.type,
    status: line.movement.status,
    qty: Number(line.qty),
    fromLocation: line.fromLocation
      ? {
          id: line.fromLocation.id,
          code: line.fromLocation.code,
          warehouseName: line.fromLocation.warehouse.name,
        }
      : null,
    toLocation: line.toLocation
      ? {
          id: line.toLocation.id,
          code: line.toLocation.code,
          warehouseName: line.toLocation.warehouse.name,
        }
      : null,
    note: line.movement.note,
    createdAt: line.movement.createdAt,
    postedAt: line.movement.postedAt,
    createdBy: line.movement.createdBy,
  }))

  return {
    items: serialize(items),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Get ISSUE movements that have been POSTED for RETURN selection
 * Only returns movements that still have items to return
 */
export async function getIssuedMovements(params: {
  page?: number
  limit?: number
  search?: string
}): Promise<PaginatedResult<{
  id: string
  docNumber: string
  note: string | null
  createdAt: Date
  postedAt: Date | null
  createdBy: { id: string; name: string }
  lines: Array<{
    id: string
    productId: string
    productName: string
    productSku: string
    variantId: string | null
    variantName: string | null
    variantSku: string | null
    fromLocationId: string | null
    fromLocationCode: string | null
    fromWarehouseName: string | null
    issuedQty: number
    returnedQty: number
    remainingQty: number
  }>
}>> {
  const { page = 1, limit = 20, search } = params

  const where = {
    type: MovementType.ISSUE,
    status: DocStatus.POSTED,
    ...(search && {
      OR: [
        { docNumber: { contains: search, mode: 'insensitive' as const } },
        { note: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        lines: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            fromLocationId: true,
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
                id: true,
                code: true,
                warehouse: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ])

  // Get all return movements that reference these issues
  const issueIds = movements.map((m) => m.id)
  const returnMovements = await prisma.stockMovement.findMany({
    where: {
      type: MovementType.RETURN,
      status: DocStatus.POSTED,
      refType: 'MOVEMENT',
      refId: { in: issueIds },
    },
    include: {
      lines: {
        select: {
          productId: true,
          variantId: true,
          qty: true,
        },
      },
    },
  })

  // Build a map of returned quantities: issueId -> productId|variantId -> qty
  const returnedQtyMap = new Map<string, Map<string, number>>()
  for (const returnMov of returnMovements) {
    if (!returnMov.refId) continue
    if (!returnedQtyMap.has(returnMov.refId)) {
      returnedQtyMap.set(returnMov.refId, new Map())
    }
    const productMap = returnedQtyMap.get(returnMov.refId)!
    for (const line of returnMov.lines) {
      const key = `${line.productId}|${line.variantId || ''}`
      const current = productMap.get(key) || 0
      productMap.set(key, current + Number(line.qty))
    }
  }

  const items = movements.map((movement) => {
    const returnedMap = returnedQtyMap.get(movement.id) || new Map()

    return {
      id: movement.id,
      docNumber: movement.docNumber,
      note: movement.note,
      createdAt: movement.createdAt,
      postedAt: movement.postedAt,
      createdBy: movement.createdBy,
      lines: movement.lines.map((line) => {
        const key = `${line.productId}|${line.variantId || ''}`
        const issuedQty = Number(line.qty)
        const returnedQty = returnedMap.get(key) || 0
        const remainingQty = issuedQty - returnedQty

        // Build variant display name
        const variantName = line.variant
          ? line.variant.optionValues.map((ov) => ov.optionValue.value).join(' / ') || line.variant.name
          : null

        return {
          id: line.id,
          productId: line.productId,
          productName: line.product.name,
          productSku: line.product.sku,
          variantId: line.variantId,
          variantName,
          variantSku: line.variant?.sku || null,
          fromLocationId: line.fromLocationId,
          fromLocationCode: line.fromLocation?.code || null,
          fromWarehouseName: line.fromLocation?.warehouse.name || null,
          issuedQty,
          returnedQty,
          remainingQty,
        }
      }),
    }
  })

  // Filter out movements with no remaining items to return
  const filteredItems = items.filter((item) =>
    item.lines.some((line) => line.remainingQty > 0)
  )

  return {
    items: serialize(filteredItems),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Get a single issued movement for RETURN reference
 */
export async function getIssuedMovementForReturn(movementId: string) {
  const movement = await prisma.stockMovement.findFirst({
    where: {
      id: movementId,
      type: MovementType.ISSUE,
      status: DocStatus.POSTED,
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      lines: {
        select: {
          id: true,
          productId: true,
          variantId: true,
          fromLocationId: true,
          qty: true,
          product: {
            select: { id: true, name: true, sku: true, hasVariants: true },
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
              id: true,
              code: true,
              warehouse: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!movement) return null

  // Get return movements for this issue
  const returnMovements = await prisma.stockMovement.findMany({
    where: {
      type: MovementType.RETURN,
      status: DocStatus.POSTED,
      refType: 'MOVEMENT',
      refId: movement.id,
    },
    include: {
      lines: {
        select: {
          productId: true,
          variantId: true,
          qty: true,
        },
      },
    },
  })

  // Build returned qty map
  const returnedMap = new Map<string, number>()
  for (const returnMov of returnMovements) {
    for (const line of returnMov.lines) {
      const key = `${line.productId}|${line.variantId || ''}`
      const current = returnedMap.get(key) || 0
      returnedMap.set(key, current + Number(line.qty))
    }
  }

  const lines = movement.lines.map((line) => {
    const key = `${line.productId}|${line.variantId || ''}`
    const issuedQty = Number(line.qty)
    const returnedQty = returnedMap.get(key) || 0
    const remainingQty = issuedQty - returnedQty

    const variantName = line.variant
      ? line.variant.optionValues.map((ov) => ov.optionValue.value).join(' / ') || line.variant.name
      : null

    return {
      id: line.id,
      productId: line.productId,
      productName: line.product.name,
      productSku: line.product.sku,
      hasVariants: line.product.hasVariants,
      variantId: line.variantId,
      variantName,
      variantSku: line.variant?.sku || null,
      fromLocationId: line.fromLocationId,
      fromLocationCode: line.fromLocation?.code || null,
      fromWarehouseName: line.fromLocation?.warehouse.name || null,
      issuedQty,
      returnedQty,
      remainingQty,
    }
  })

  return serialize({
    id: movement.id,
    docNumber: movement.docNumber,
    note: movement.note,
    createdAt: movement.createdAt,
    postedAt: movement.postedAt,
    createdBy: movement.createdBy,
    lines,
  })
}

// ============================================
// Batch Actions
// ============================================

import type { BatchResult, BatchResultItem } from '@/types'

const MAX_BATCH_SIZE = 50

/**
 * Batch approve multiple movements (SUBMITTED → APPROVED)
 */
export async function batchApproveMovements(ids: string[]): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการอนุมัติ' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  try {
    // Fetch all movements
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: ids } },
      select: { id: true, docNumber: true, status: true },
    })

    const results: BatchResultItem[] = []
    let succeeded = 0
    let failed = 0

    for (const movement of movements) {
      if (movement.status !== DocStatus.SUBMITTED) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: `สถานะไม่ถูกต้อง (${movement.status}) ต้องเป็น SUBMITTED`,
        })
        failed++
        continue
      }

      try {
        await prisma.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: DocStatus.APPROVED,
            approvedById: session.id,
          },
        })

        // Audit log (non-blocking)
        prisma.auditLog.create({
          data: {
            actorId: session.id,
            action: 'BATCH_APPROVE',
            refType: 'MOVEMENT',
            refId: movement.id,
          },
        }).catch((err) => console.error('Failed to create audit log:', err))

        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: true,
        })
        succeeded++
      } catch (err) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        })
        failed++
      }
    }

    // Add results for IDs not found
    const foundIds = new Set(movements.map(m => m.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({
          id,
          docNumber: '-',
          success: false,
          error: 'ไม่พบรายการ',
        })
        failed++
      }
    }

    revalidatePath('/movements')
    
    return {
      success: true,
      data: {
        total: ids.length,
        succeeded,
        failed,
        results,
      },
    }
  } catch (error) {
    console.error('Batch approve error:', error)
    return { success: false, error: 'ไม่สามารถอนุมัติรายการได้' }
  }
}

/**
 * Batch reject multiple movements (SUBMITTED → REJECTED)
 */
export async function batchRejectMovements(ids: string[], reason?: string): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการปฏิเสธ' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  try {
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: ids } },
      select: { id: true, docNumber: true, status: true, note: true },
    })

    const results: BatchResultItem[] = []
    let succeeded = 0
    let failed = 0

    for (const movement of movements) {
      if (movement.status !== DocStatus.SUBMITTED) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: `สถานะไม่ถูกต้อง (${movement.status}) ต้องเป็น SUBMITTED`,
        })
        failed++
        continue
      }

      try {
        await prisma.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: DocStatus.REJECTED,
            note: reason ? `${movement.note || ''}\n[ปฏิเสธ] ${reason}` : movement.note,
          },
        })

        // Audit log (non-blocking)
        prisma.auditLog.create({
          data: {
            actorId: session.id,
            action: 'BATCH_REJECT',
            refType: 'MOVEMENT',
            refId: movement.id,
            newData: { reason },
          },
        }).catch((err) => console.error('Failed to create audit log:', err))

        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: true,
        })
        succeeded++
      } catch (err) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        })
        failed++
      }
    }

    // Add results for IDs not found
    const foundIds = new Set(movements.map(m => m.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({
          id,
          docNumber: '-',
          success: false,
          error: 'ไม่พบรายการ',
        })
        failed++
      }
    }

    revalidatePath('/movements')
    
    return {
      success: true,
      data: {
        total: ids.length,
        succeeded,
        failed,
        results,
      },
    }
  } catch (error) {
    console.error('Batch reject error:', error)
    return { success: false, error: 'ไม่สามารถปฏิเสธรายการได้' }
  }
}

/**
 * Batch post multiple movements (APPROVED → POSTED)
 * This is the most complex batch operation as it updates stock balances
 */
export async function batchPostMovements(ids: string[]): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการ Post' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  const results: BatchResultItem[] = []
  let succeeded = 0
  let failed = 0

  // Process each movement individually to handle partial failures
  for (const id of ids) {
    const result = await postMovement(id)
    
    // Get movement info for the result
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      select: { docNumber: true },
    })

    if (result.success) {
      results.push({
        id,
        docNumber: movement?.docNumber || '-',
        success: true,
      })
      succeeded++
    } else {
      results.push({
        id,
        docNumber: movement?.docNumber || '-',
        success: false,
        error: result.error,
      })
      failed++
    }
  }

  revalidatePath('/movements')
  revalidatePath('/stock')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: {
      total: ids.length,
      succeeded,
      failed,
      results,
    },
  }
}

/**
 * Batch cancel multiple movements
 * Works for DRAFT, SUBMITTED, APPROVED statuses
 */
export async function batchCancelMovements(ids: string[], reason?: string): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการยกเลิก' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  const CANCELLABLE_STATUSES: DocStatus[] = [DocStatus.DRAFT, DocStatus.SUBMITTED, DocStatus.APPROVED]

  try {
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: ids } },
      select: { id: true, docNumber: true, status: true, note: true },
    })

    const results: BatchResultItem[] = []
    let succeeded = 0
    let failed = 0

    for (const movement of movements) {
      if (!CANCELLABLE_STATUSES.includes(movement.status)) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: `ไม่สามารถยกเลิกรายการที่มีสถานะ ${movement.status} ได้`,
        })
        failed++
        continue
      }

      try {
        await prisma.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: DocStatus.CANCELLED,
            note: reason ? `${movement.note || ''}\n[ยกเลิก] ${reason}` : movement.note,
          },
        })

        // Audit log (non-blocking)
        prisma.auditLog.create({
          data: {
            actorId: session.id,
            action: 'BATCH_CANCEL',
            refType: 'MOVEMENT',
            refId: movement.id,
            newData: { reason },
          },
        }).catch((err) => console.error('Failed to create audit log:', err))

        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: true,
        })
        succeeded++
      } catch (err) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        })
        failed++
      }
    }

    // Add results for IDs not found
    const foundIds = new Set(movements.map(m => m.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({
          id,
          docNumber: '-',
          success: false,
          error: 'ไม่พบรายการ',
        })
        failed++
      }
    }

    revalidatePath('/movements')
    
    return {
      success: true,
      data: {
        total: ids.length,
        succeeded,
        failed,
        results,
      },
    }
  } catch (error) {
    console.error('Batch cancel error:', error)
    return { success: false, error: 'ไม่สามารถยกเลิกรายการได้' }
  }
}
