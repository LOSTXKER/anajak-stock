'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { MovementType, DocStatus } from '@/generated/prisma'
import { serialize } from '@/lib/serialize'
import type { ActionResult, PaginatedResult, MovementWithRelations } from '@/types'
import type { CreateMovementInput, UpdateMovementInput } from './shared'
import { generateDocNumber } from './shared'

export async function getMovements(params: {
  page?: number
  limit?: number
  type?: MovementType
  status?: DocStatus
  search?: string
  dateFrom?: string
  dateTo?: string
  orderRef?: string
}): Promise<PaginatedResult<MovementWithRelations>> {
  const { page = 1, limit = 20, type, status, search, dateFrom, dateTo, orderRef } = params

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
    ...(orderRef && {
      lines: {
        some: {
          orderRef: { contains: orderRef, mode: 'insensitive' as const },
        },
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

    const lotIdMap = new Map<number, string>()
    
    if (data.type === 'RECEIVE') {
      const linesWithNewLot = data.lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.newLotNumber && !line.lotId)

      if (linesWithNewLot.length > 0) {
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

        const existingLotMap = new Map(
          existingLots.map(lot => [`${lot.productId}:${lot.lotNumber}`, lot.id])
        )

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

        if (linesToCreateLot.length > 0) {
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

          const newLots = await prisma.lot.findMany({
            where: {
              OR: [...uniqueLotsToCreate.values()].map(lot => ({
                lotNumber: lot.lotNumber,
                productId: lot.productId,
              })),
            },
          })

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
              orderRef: line.orderRef || null,
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

    if (movement.status !== DocStatus.DRAFT && movement.status !== DocStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถแก้ไขรายการที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    await prisma.movementLine.deleteMany({
      where: { movementId: id },
    })

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
            orderRef: line.orderRef || null,
          })),
        },
      },
    })

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
