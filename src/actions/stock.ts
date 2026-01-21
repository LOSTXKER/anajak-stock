'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import type { PaginatedResult, StockBalanceWithProduct } from '@/types'

export async function getStockBalances(params: {
  page?: number
  limit?: number
  search?: string
  warehouseId?: string
  categoryId?: string
  lowStockOnly?: boolean
}): Promise<PaginatedResult<StockBalanceWithProduct>> {
  const { page = 1, limit = 20, search, warehouseId, categoryId, lowStockOnly } = params

  // For lowStockOnly, use raw SQL to efficiently filter at database level
  if (lowStockOnly) {
    return getLowStockBalances({ page, limit, search, warehouseId, categoryId })
  }

  const where = {
    // Only show items with stock > 0
    qtyOnHand: { gt: 0 },
    product: {
      active: true,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
    },
    location: {
      active: true,
      deletedAt: null,
      ...(warehouseId && { warehouseId }),
    },
  }

  const [items, total] = await Promise.all([
    prisma.stockBalance.findMany({
      where,
      include: {
        product: {
          select: {
            id: true, name: true, sku: true, reorderPoint: true, standardCost: true,
            category: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
        },
        variant: {
          select: {
            id: true, name: true, sku: true,
            optionValues: {
              select: {
                optionValue: {
                  select: {
                    value: true,
                    optionType: { select: { displayOrder: true } },
                  },
                },
              },
              orderBy: {
                optionValue: { optionType: { displayOrder: 'asc' } },
              },
            },
          },
        },
        location: {
          select: {
            id: true, name: true, code: true,
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { variant: { name: 'asc' } },
        { location: { code: 'asc' } },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockBalance.count({ where }),
  ])

  return {
    items: items as StockBalanceWithProduct[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// Efficient low stock query using raw SQL for the comparison
async function getLowStockBalances(params: {
  page: number
  limit: number
  search?: string
  warehouseId?: string
  categoryId?: string
}): Promise<PaginatedResult<StockBalanceWithProduct>> {
  const { page, limit, search, warehouseId, categoryId } = params
  const offset = (page - 1) * limit
  const searchPattern = search ? `%${search}%` : null

  // Get IDs with proper pagination using raw SQL
  // This allows us to compare qtyOnHand <= reorderPoint at database level
  const idsResult = await prisma.$queryRaw<{ id: string }[]>`
    SELECT sb.id
    FROM stock_balances sb
    JOIN products p ON sb."productId" = p.id
    JOIN locations l ON sb."locationId" = l.id
    WHERE p.active = true
      AND p."deletedAt" IS NULL
      AND l.active = true
      AND l."deletedAt" IS NULL
      AND p."reorderPoint" > 0
      AND sb."qtyOnHand" <= p."reorderPoint"
      AND sb."qtyOnHand" > 0
      AND (${searchPattern}::text IS NULL OR (p.name ILIKE ${searchPattern} OR p.sku ILIKE ${searchPattern}))
      AND (${warehouseId}::text IS NULL OR l."warehouseId" = ${warehouseId})
      AND (${categoryId}::text IS NULL OR p."categoryId" = ${categoryId})
    ORDER BY p.name ASC, l.code ASC
    LIMIT ${limit} OFFSET ${offset}
  `

  // Count query
  const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM stock_balances sb
    JOIN products p ON sb."productId" = p.id
    JOIN locations l ON sb."locationId" = l.id
    WHERE p.active = true
      AND p."deletedAt" IS NULL
      AND l.active = true
      AND l."deletedAt" IS NULL
      AND p."reorderPoint" > 0
      AND sb."qtyOnHand" <= p."reorderPoint"
      AND sb."qtyOnHand" > 0
      AND (${searchPattern}::text IS NULL OR (p.name ILIKE ${searchPattern} OR p.sku ILIKE ${searchPattern}))
      AND (${warehouseId}::text IS NULL OR l."warehouseId" = ${warehouseId})
      AND (${categoryId}::text IS NULL OR p."categoryId" = ${categoryId})
  `
  const total = Number(countResult[0]?.count ?? 0)

  const ids = idsResult.map((r) => r.id)

  // Fetch full data using Prisma for the filtered IDs
  const items = ids.length > 0
    ? await prisma.stockBalance.findMany({
        where: { id: { in: ids } },
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, reorderPoint: true, standardCost: true,
              category: { select: { id: true, name: true } },
              unit: { select: { id: true, name: true, code: true } },
            },
          },
          variant: {
            select: {
              id: true, name: true, sku: true,
              optionValues: {
                select: {
                  optionValue: {
                    select: {
                      value: true,
                      optionType: { select: { displayOrder: true } },
                    },
                  },
                },
                orderBy: {
                  optionValue: { optionType: { displayOrder: 'asc' } },
                },
              },
            },
          },
          location: {
            select: {
              id: true, name: true, code: true,
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: [
          { product: { name: 'asc' } },
          { variant: { name: 'asc' } },
          { location: { code: 'asc' } },
        ],
      })
    : []

  return {
    items: items as StockBalanceWithProduct[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getStockByProduct(productId: string) {
  return prisma.stockBalance.findMany({
    where: {
      productId,
      location: {
        active: true,
        deletedAt: null,
      },
    },
    include: {
      location: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: {
      location: {
        code: 'asc',
      },
    },
  })
}

export async function getStockByLocation(locationId: string) {
  return prisma.stockBalance.findMany({
    where: {
      locationId,
      product: {
        active: true,
        deletedAt: null,
      },
    },
    include: {
      product: {
        include: {
          category: true,
          unit: true,
        },
      },
    },
    orderBy: {
      product: {
        name: 'asc',
      },
    },
  })
}

export async function getWarehouses() {
  return prisma.warehouse.findMany({
    where: { active: true, deletedAt: null },
    include: {
      locations: {
        where: { active: true, deletedAt: null },
        orderBy: { code: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getLocations(warehouseId?: string) {
  return prisma.location.findMany({
    where: {
      active: true,
      deletedAt: null,
      ...(warehouseId && { warehouseId }),
    },
    include: {
      warehouse: true,
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { code: 'asc' },
    ],
  })
}

export async function getStockSummary() {
  const [totalValue, productCount, lowStockCount] = await Promise.all([
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(sb."qtyOnHand" * p."standardCost"), 0) as total
      FROM stock_balances sb
      JOIN products p ON sb."productId" = p.id
      WHERE p.active = true AND p."deletedAt" IS NULL
    `,
    prisma.product.count({ where: { active: true, deletedAt: null } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT sb."productId") as count
      FROM stock_balances sb
      JOIN products p ON sb."productId" = p.id
      WHERE sb."qtyOnHand" <= p."reorderPoint"
      AND p."reorderPoint" > 0
      AND p.active = true
      AND p."deletedAt" IS NULL
    `,
  ])

  return {
    totalValue: Number(totalValue[0]?.total ?? 0),
    productCount,
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
  }
}
