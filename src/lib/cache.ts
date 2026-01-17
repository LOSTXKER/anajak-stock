import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'
import { MovementType, DocStatus, PRStatus, POStatus } from '@/generated/prisma'

// Cache duration in seconds
const CACHE_DURATION = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 3600,       // 1 hour
  VERY_LONG: 86400, // 1 day
}

// ==================== CACHED QUERIES ====================

/**
 * Get categories with caching
 * Categories don't change often, so we cache for 5 minutes
 */
export const getCachedCategories = unstable_cache(
  async () => {
    return prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
  },
  ['categories'],
  { revalidate: CACHE_DURATION.MEDIUM, tags: ['categories'] }
)

/**
 * Get warehouses with caching
 */
export const getCachedWarehouses = unstable_cache(
  async () => {
    return prisma.warehouse.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    })
  },
  ['warehouses'],
  { revalidate: CACHE_DURATION.MEDIUM, tags: ['warehouses'] }
)

/**
 * Get locations with caching
 */
export const getCachedLocations = unstable_cache(
  async (warehouseId?: string) => {
    return prisma.location.findMany({
      where: {
        deletedAt: null,
        active: true,
        ...(warehouseId && { warehouseId }),
      },
      include: { warehouse: true },
      orderBy: [{ warehouse: { name: 'asc' } }, { code: 'asc' }],
    })
  },
  ['locations'],
  { revalidate: CACHE_DURATION.MEDIUM, tags: ['locations'] }
)

/**
 * Get units with caching
 */
export const getCachedUnits = unstable_cache(
  async () => {
    return prisma.unitOfMeasure.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    })
  },
  ['units'],
  { revalidate: CACHE_DURATION.LONG, tags: ['units'] }
)

/**
 * Get suppliers with caching
 */
export const getCachedSuppliers = unstable_cache(
  async () => {
    return prisma.supplier.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    })
  },
  ['suppliers'],
  { revalidate: CACHE_DURATION.MEDIUM, tags: ['suppliers'] }
)

/**
 * Get option types with caching
 */
export const getCachedOptionTypes = unstable_cache(
  async () => {
    return prisma.optionType.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        values: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })
  },
  ['optionTypes'],
  { revalidate: CACHE_DURATION.MEDIUM, tags: ['optionTypes'] }
)

/**
 * Get products count by category
 */
export const getCachedProductCountByCategory = unstable_cache(
  async () => {
    const result = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null, active: true },
      _count: { id: true },
    })
    return result
  },
  ['productCountByCategory'],
  { revalidate: CACHE_DURATION.SHORT, tags: ['products'] }
)

/**
 * Get dashboard stats with caching
 */
export const getCachedDashboardStats = unstable_cache(
  async () => {
    const [
      totalProducts,
      totalSKUs,
      lowStockCount,
      pendingPRs,
      pendingPOs,
    ] = await Promise.all([
      prisma.product.count({ where: { deletedAt: null, active: true } }),
      prisma.productVariant.count({ where: { deletedAt: null, active: true } }),
      prisma.stockBalance.count({
        where: {
          qtyOnHand: { lte: 10 }, // Simplified: items with 10 or less in stock
        },
      }).catch(() => 0),
      prisma.pR.count({ where: { status: 'SUBMITTED' } }),
      prisma.pO.count({ where: { status: { in: ['DRAFT', 'APPROVED', 'SENT'] } } }),
    ])

    return {
      totalProducts,
      totalSKUs,
      lowStockCount,
      pendingPRs,
      pendingPOs,
    }
  },
  ['dashboardStats'],
  { revalidate: CACHE_DURATION.SHORT, tags: ['dashboard'] }
)

// ==================== LIST CACHING FUNCTIONS ====================

/**
 * Create a cached key for paginated queries
 */
function createPaginatedKey(prefix: string, params: Record<string, unknown>): string[] {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',')
  return [prefix, sortedParams || 'default']
}

/**
 * Get products list with caching (for product listing page)
 */
export function getCachedProducts(params: {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
}) {
  const cacheKey = createPaginatedKey('products', params)
  
  return unstable_cache(
    async () => {
      const { page = 1, limit = 20, search, categoryId } = params

      const where = {
        active: true,
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { barcode: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
        ...(categoryId && { categoryId }),
      }

      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.product.count({ where }),
      ])

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },
    cacheKey,
    { revalidate: CACHE_DURATION.SHORT, tags: ['products'] }
  )()
}

/**
 * Get movements list with caching (for movements listing page)
 */
export function getCachedMovements(params: {
  page?: number
  limit?: number
  type?: MovementType
  status?: DocStatus
  search?: string
}) {
  const cacheKey = createPaginatedKey('movements', params)
  
  return unstable_cache(
    async () => {
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
            createdBy: { select: { id: true, name: true } },
            lines: {
              take: 1, // Only first line for preview
              select: {
                product: { select: { name: true } },
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
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },
    cacheKey,
    { revalidate: CACHE_DURATION.SHORT, tags: ['movements'] }
  )()
}

/**
 * Get PRs list with caching (for PR listing page)
 */
export function getCachedPRs(params: {
  page?: number
  limit?: number
  status?: PRStatus
  search?: string
}) {
  const cacheKey = createPaginatedKey('prs', params)
  
  return unstable_cache(
    async () => {
      const { page = 1, limit = 20, status, search } = params

      const where = {
        ...(status && { status }),
        ...(search && {
          OR: [
            { prNumber: { contains: search, mode: 'insensitive' as const } },
            { note: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      }

      const [items, total] = await Promise.all([
        prisma.pR.findMany({
          where,
          include: {
            requester: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
            lines: {
              select: {
                id: true,
                qty: true,
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.pR.count({ where }),
      ])

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },
    cacheKey,
    { revalidate: CACHE_DURATION.SHORT, tags: ['prs'] }
  )()
}

/**
 * Get POs list with caching (for PO listing page)
 */
export function getCachedPOs(params: {
  page?: number
  limit?: number
  status?: POStatus
  supplierId?: string
  search?: string
}) {
  const cacheKey = createPaginatedKey('pos', params)
  
  return unstable_cache(
    async () => {
      const { page = 1, limit = 20, status, supplierId, search } = params

      const where = {
        ...(status && { status }),
        ...(supplierId && { supplierId }),
        ...(search && {
          OR: [
            { poNumber: { contains: search, mode: 'insensitive' as const } },
            { note: { contains: search, mode: 'insensitive' as const } },
            { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }),
      }

      const [items, total] = await Promise.all([
        prisma.pO.findMany({
          where,
          include: {
            supplier: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, name: true } },
            lines: {
              select: {
                id: true,
                qty: true,
                qtyReceived: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.pO.count({ where }),
      ])

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },
    cacheKey,
    { revalidate: CACHE_DURATION.SHORT, tags: ['pos'] }
  )()
}
