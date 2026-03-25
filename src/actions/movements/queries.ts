'use server'

import { prisma } from '@/lib/prisma'
import { MovementType, DocStatus } from '@/generated/prisma'
import { serialize } from '@/lib/serialize'
import type { PaginatedResult, MovementWithRelations } from '@/types'

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
