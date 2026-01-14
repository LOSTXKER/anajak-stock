import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'

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
      select: { id: true, name: true, code: true },
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
    return prisma.unit.findMany({
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
      orderBy: { sortOrder: 'asc' },
      include: {
        values: {
          orderBy: { sortOrder: 'asc' },
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
          qtyOnHand: { lte: prisma.raw('product.reorder_point') },
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
