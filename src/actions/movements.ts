'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { MovementType, DocStatus } from '@/generated/prisma'
import type { ActionResult, PaginatedResult, MovementWithRelations } from '@/types'

interface MovementLineInput {
  productId: string
  variantId?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost?: number
  note?: string
}

interface CreateMovementInput {
  type: MovementType
  note?: string
  reason?: string
  projectCode?: string
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
}): Promise<PaginatedResult<MovementWithRelations>> {
  const { page = 1, limit = 20, type, status, search } = params

  const where = {
    ...(type && { type }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { docNumber: { contains: search, mode: 'insensitive' as const } },
        { note: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        approvedBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        lines: {
          include: {
            product: true,
            fromLocation: { include: { warehouse: true } },
            toLocation: { include: { warehouse: true } },
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
    items: items as unknown as MovementWithRelations[],
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
        select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
      },
      approvedBy: {
        select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
      },
      lines: {
        include: {
          product: true,
          variant: true,
          fromLocation: { include: { warehouse: true } },
          toLocation: { include: { warehouse: true } },
        },
      },
    },
  })

  if (!movement) return null

  // Convert Decimal to Number for client components
  const serializedMovement = {
    ...movement,
    lines: movement.lines.map(line => ({
      ...line,
      qty: Number(line.qty),
      unitCost: Number(line.unitCost),
    })),
  }

  return serializedMovement as unknown as MovementWithRelations | null
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

    const movement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: data.type,
        status: DocStatus.DRAFT,
        note: data.note,
        reason: data.reason,
        projectCode: data.projectCode,
        createdById: session.id,
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
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        approvedBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
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

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'MOVEMENT',
        refId: movement.id,
        newData: { docNumber, type: data.type },
      },
    })

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

    if (movement.status !== DocStatus.DRAFT) {
      return { success: false, error: 'ไม่สามารถส่งรายการที่ไม่ใช่ Draft ได้' }
    }

    if (movement.lines.length === 0) {
      return { success: false, error: 'กรุณาเพิ่มรายการสินค้าก่อนส่ง' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: { status: DocStatus.SUBMITTED },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'SUBMIT',
        refType: 'MOVEMENT',
        refId: id,
      },
    })

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

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'APPROVE',
        refType: 'MOVEMENT',
        refId: id,
      },
    })

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

      // Update stock balances based on movement type
      for (const line of movement.lines) {
        const qty = Number(line.qty)
        const variantId = line.variantId || null
        const productName = line.variant 
          ? `${line.product.name} (${line.variant.sku})`
          : line.product.name

        switch (movement.type) {
          case MovementType.RECEIVE:
            // Increase stock at destination
            if (line.toLocationId) {
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
            }
            break

          case MovementType.ISSUE:
            // Decrease stock at source
            if (line.fromLocationId) {
              await decrementStock(line.productId, variantId, line.fromLocationId, qty, productName)
            }
            break

          case MovementType.TRANSFER:
            // Decrease from source, increase at destination
            if (line.fromLocationId && line.toLocationId) {
              await decrementStock(line.productId, variantId, line.fromLocationId, qty, productName)
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
            }
            break

          case MovementType.ADJUST:
            // Adjust stock: positive qty = add, negative qty = subtract
            if (line.toLocationId) {
              if (qty >= 0) {
                await incrementStock(line.productId, variantId, line.toLocationId, qty)
              } else {
                // qty is negative, decrement by absolute value
                await decrementStock(line.productId, variantId, line.toLocationId, Math.abs(qty), productName)
              }
            }
            break

          case MovementType.RETURN:
            // Increase stock at destination (return to stock)
            if (line.toLocationId) {
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
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
    })

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

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'REJECT',
        refType: 'MOVEMENT',
        refId: id,
        newData: { reason },
      },
    })

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

    if (movement.status !== DocStatus.DRAFT) {
      return { success: false, error: 'ไม่สามารถแก้ไขรายการที่ไม่ใช่ Draft ได้' }
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

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'MOVEMENT',
        refId: id,
      },
    })

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

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CANCEL',
        refType: 'MOVEMENT',
        refId: id,
        newData: { reason },
      },
    })

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Cancel movement error:', error)
    return { success: false, error: 'ไม่สามารถยกเลิกรายการได้' }
  }
}
