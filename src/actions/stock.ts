'use server'

import { prisma } from '@/lib/prisma'
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

  let items = await prisma.stockBalance.findMany({
    where,
    include: {
      product: {
        include: {
          category: true,
          unit: true,
        },
      },
      location: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: [
      { product: { name: 'asc' } },
      { location: { code: 'asc' } },
    ],
  })

  // Filter low stock if needed
  if (lowStockOnly) {
    items = items.filter(
      (item) =>
        Number(item.product.reorderPoint) > 0 &&
        Number(item.qtyOnHand) <= Number(item.product.reorderPoint)
    )
  }

  const total = items.length
  const paginatedItems = items.slice((page - 1) * limit, page * limit)

  return {
    items: paginatedItems as StockBalanceWithProduct[],
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
