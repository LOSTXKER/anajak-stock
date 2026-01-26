'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import type { PaginatedResult, StockBalanceWithProduct } from '@/types'

export type StockSortField = 'sku' | 'name' | 'category' | 'warehouse' | 'location' | 'qty' | 'rop'
export type SortOrder = 'asc' | 'desc'

export async function getStockBalances(params: {
  page?: number
  limit?: number
  search?: string
  warehouseId?: string
  categoryId?: string
  lowStockOnly?: boolean
  sortBy?: StockSortField
  sortOrder?: SortOrder
}): Promise<PaginatedResult<StockBalanceWithProduct>> {
  const { 
    page = 1, 
    limit = 20, 
    search, 
    warehouseId, 
    categoryId, 
    lowStockOnly,
    sortBy = 'sku',
    sortOrder = 'asc',
  } = params

  // For lowStockOnly, use raw SQL to efficiently filter at database level
  if (lowStockOnly) {
    return getLowStockBalances({ page, limit, search, warehouseId, categoryId, sortBy, sortOrder })
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

  // Build orderBy based on sortBy
  const orderBy = buildStockOrderBy(sortBy, sortOrder)

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
      orderBy,
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

function buildStockOrderBy(sortBy: StockSortField, sortOrder: SortOrder): Prisma.StockBalanceOrderByWithRelationInput[] {
  const order = sortOrder

  switch (sortBy) {
    case 'sku':
      return [
        { product: { sku: order } },
        { variant: { sku: order } },
        { location: { code: 'asc' } },
      ]
    case 'name':
      return [
        { product: { name: order } },
        { variant: { name: order } },
        { location: { code: 'asc' } },
      ]
    case 'category':
      return [
        { product: { category: { name: order } } },
        { product: { name: 'asc' } },
        { location: { code: 'asc' } },
      ]
    case 'warehouse':
      return [
        { location: { warehouse: { name: order } } },
        { location: { code: 'asc' } },
        { product: { name: 'asc' } },
      ]
    case 'location':
      return [
        { location: { code: order } },
        { product: { name: 'asc' } },
      ]
    case 'qty':
      return [
        { qtyOnHand: order },
        { product: { name: 'asc' } },
      ]
    case 'rop':
      return [
        { product: { reorderPoint: order } },
        { product: { name: 'asc' } },
      ]
    default:
      return [
        { product: { sku: 'asc' } },
        { variant: { sku: 'asc' } },
        { location: { code: 'asc' } },
      ]
  }
}

// Efficient low stock query using raw SQL for the comparison
async function getLowStockBalances(params: {
  page: number
  limit: number
  search?: string
  warehouseId?: string
  categoryId?: string
  sortBy?: StockSortField
  sortOrder?: SortOrder
}): Promise<PaginatedResult<StockBalanceWithProduct>> {
  const { page, limit, search, warehouseId, categoryId, sortBy = 'sku', sortOrder = 'asc' } = params
  const offset = (page - 1) * limit
  const searchPattern = search ? `%${search}%` : null

  // Build ORDER BY clause for raw SQL
  const orderClause = buildRawSqlOrderBy(sortBy, sortOrder)

  // Get IDs with proper pagination using raw SQL
  // This allows us to compare qtyOnHand <= reorderPoint at database level
  const idsResult = await prisma.$queryRawUnsafe<{ id: string }[]>(`
    SELECT sb.id
    FROM stock_balances sb
    JOIN products p ON sb."productId" = p.id
    JOIN locations l ON sb."locationId" = l.id
    LEFT JOIN categories c ON p."categoryId" = c.id
    LEFT JOIN warehouses w ON l."warehouseId" = w.id
    WHERE p.active = true
      AND p."deletedAt" IS NULL
      AND l.active = true
      AND l."deletedAt" IS NULL
      AND p."reorderPoint" > 0
      AND sb."qtyOnHand" <= p."reorderPoint"
      AND sb."qtyOnHand" > 0
      AND ($1::text IS NULL OR (p.name ILIKE $1 OR p.sku ILIKE $1))
      AND ($2::text IS NULL OR l."warehouseId" = $2)
      AND ($3::text IS NULL OR p."categoryId" = $3)
    ${orderClause}
    LIMIT $4 OFFSET $5
  `, searchPattern, warehouseId || null, categoryId || null, limit, offset)

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
      AND (${warehouseId || null}::text IS NULL OR l."warehouseId" = ${warehouseId || null})
      AND (${categoryId || null}::text IS NULL OR p."categoryId" = ${categoryId || null})
  `
  const total = Number(countResult[0]?.count ?? 0)

  const ids = idsResult.map((r) => r.id)

  // Build orderBy for Prisma
  const orderBy = buildStockOrderBy(sortBy, sortOrder)

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
        orderBy,
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

function buildRawSqlOrderBy(sortBy: StockSortField, sortOrder: SortOrder): string {
  const order = sortOrder.toUpperCase()

  switch (sortBy) {
    case 'sku':
      return `ORDER BY p.sku ${order}, l.code ASC`
    case 'name':
      return `ORDER BY p.name ${order}, l.code ASC`
    case 'category':
      return `ORDER BY c.name ${order} NULLS LAST, p.name ASC`
    case 'warehouse':
      return `ORDER BY w.name ${order}, l.code ASC`
    case 'location':
      return `ORDER BY l.code ${order}, p.name ASC`
    case 'qty':
      return `ORDER BY sb."qtyOnHand" ${order}, p.name ASC`
    case 'rop':
      return `ORDER BY p."reorderPoint" ${order}, p.name ASC`
    default:
      return `ORDER BY p.sku ASC, l.code ASC`
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
