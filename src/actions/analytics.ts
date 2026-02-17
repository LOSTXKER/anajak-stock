'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { unstable_cache } from 'next/cache'
import type { ActionResult } from '@/types'

// ============================================
// ABC Analysis
// ============================================

export interface ABCItem {
  id: string
  sku: string
  name: string
  category: string | null
  totalValue: number
  percentage: number
  cumulativePercentage: number
  classification: 'A' | 'B' | 'C'
}

const getCachedABCData = unstable_cache(
  async () => {
    const products = await prisma.$queryRaw<
      { id: string; sku: string; name: string; category_name: string | null; total_value: number }[]
    >`
      SELECT 
        p.id,
        p.sku,
        p.name,
        c.name as category_name,
        COALESCE(SUM(sb.qty_on_hand * p.last_cost), 0) as total_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_balances sb ON p.id = sb.product_id
      WHERE p.deleted_at IS NULL AND p.active = true
      GROUP BY p.id, p.sku, p.name, c.name
      HAVING COALESCE(SUM(sb.qty_on_hand * p.last_cost), 0) > 0
      ORDER BY total_value DESC
    `

    const totalValue = products.reduce((sum, p) => sum + Number(p.total_value), 0)
    
    let cumulativePercentage = 0
    const items: ABCItem[] = products.map((p) => {
      const percentage = totalValue > 0 ? (Number(p.total_value) / totalValue) * 100 : 0
      cumulativePercentage += percentage

      let classification: 'A' | 'B' | 'C' = 'C'
      if (cumulativePercentage <= 80) {
        classification = 'A'
      } else if (cumulativePercentage <= 95) {
        classification = 'B'
      }

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category_name,
        totalValue: Number(p.total_value),
        percentage,
        cumulativePercentage,
        classification,
      }
    })

    return items
  },
  ['abc-analysis'],
  { revalidate: 600 }
)

export async function getABCAnalysis(): Promise<ActionResult<ABCItem[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const items = await getCachedABCData()
    return { success: true, data: items }
  } catch (error) {
    console.error('Error getting ABC analysis:', error)
    return { success: false, error: 'ไม่สามารถวิเคราะห์ข้อมูลได้' }
  }
}

// ============================================
// Stock Turnover Analysis
// ============================================

export interface TurnoverItem {
  id: string
  sku: string
  name: string
  category: string | null
  avgStock: number
  totalIssued: number
  turnoverRate: number // times per year
  daysOfStock: number  // how many days until stock runs out at current rate
}

export async function getStockTurnoverAnalysis(
  days: number = 90
): Promise<ActionResult<TurnoverItem[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get issue movements for the period
    const issues = await prisma.$queryRaw<
      { product_id: string; total_issued: number }[]
    >`
      SELECT 
        ml.product_id,
        SUM(ml.qty) as total_issued
      FROM movement_lines ml
      JOIN stock_movements sm ON ml.movement_id = sm.id
      WHERE sm.type = 'ISSUE'
        AND sm.status = 'POSTED'
        AND sm.posted_at >= ${startDate}
      GROUP BY ml.product_id
    `

    const issueMap = new Map(issues.map(i => [i.product_id, Number(i.total_issued)]))

    // Get current stock levels
    const products = await prisma.product.findMany({
      where: { active: true, deletedAt: null },
      include: {
        category: true,
        stockBalances: true,
      },
    })

    const items: TurnoverItem[] = products
      .map((p) => {
        const currentStock = p.stockBalances.reduce(
          (sum, sb) => sum + Number(sb.qtyOnHand),
          0
        )
        const totalIssued = issueMap.get(p.id) || 0
        const avgDailyIssue = totalIssued / days
        const annualizedIssue = avgDailyIssue * 365

        // Turnover rate = Annual usage / Average inventory
        // Simplified: use current stock as average
        const turnoverRate = currentStock > 0 ? annualizedIssue / currentStock : 0
        const daysOfStock = avgDailyIssue > 0 ? currentStock / avgDailyIssue : 999

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name || null,
          avgStock: currentStock,
          totalIssued,
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          daysOfStock: Math.round(daysOfStock),
        }
      })
      .filter((i) => i.avgStock > 0 || i.totalIssued > 0)
      .sort((a, b) => b.turnoverRate - a.turnoverRate)

    return { success: true, data: items }
  } catch (error) {
    console.error('Error getting turnover analysis:', error)
    return { success: false, error: 'ไม่สามารถวิเคราะห์ข้อมูลได้' }
  }
}

// ============================================
// Movement Trends
// ============================================

export interface MovementTrend {
  date: string
  receive: number
  issue: number
  transfer: number
  adjust: number
}

export async function getMovementTrends(
  days: number = 30
): Promise<ActionResult<MovementTrend[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const movements = await prisma.$queryRaw<
      { date: string; type: string; count: number; total_qty: number }[]
    >`
      SELECT 
        DATE(sm.posted_at) as date,
        sm.type,
        COUNT(*) as count,
        COALESCE(SUM(ml.qty), 0) as total_qty
      FROM stock_movements sm
      JOIN movement_lines ml ON sm.id = ml.movement_id
      WHERE sm.status = 'POSTED'
        AND sm.posted_at >= ${startDate}
      GROUP BY DATE(sm.posted_at), sm.type
      ORDER BY date
    `

    // Group by date
    const dateMap = new Map<string, MovementTrend>()
    for (let i = 0; i <= days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dateMap.set(dateStr, {
        date: dateStr,
        receive: 0,
        issue: 0,
        transfer: 0,
        adjust: 0,
      })
    }

    for (const m of movements) {
      const trend = dateMap.get(m.date)
      if (trend) {
        const key = m.type.toLowerCase() as 'receive' | 'issue' | 'transfer' | 'adjust'
        if (key in trend) {
          trend[key] = Number(m.total_qty)
        }
      }
    }

    const result = Array.from(dateMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    )

    return { success: true, data: result }
  } catch (error) {
    console.error('Error getting movement trends:', error)
    return { success: false, error: 'ไม่สามารถโหลดข้อมูลได้' }
  }
}

// ============================================
// Category Performance
// ============================================

export interface CategoryPerformance {
  id: string
  name: string
  productCount: number
  totalValue: number
  totalMovements: number
  avgTurnover: number
}

const getCachedCategoryPerformance = unstable_cache(
  async () => {
    const categories = await prisma.category.findMany({
      where: { active: true, deletedAt: null },
      include: {
        products: {
          where: { active: true, deletedAt: null },
          include: {
            stockBalances: true,
            movementLines: {
              where: {
                movement: {
                  status: 'POSTED',
                  postedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
                },
              },
            },
          },
        },
      },
    })

    return categories.map((cat) => {
      const totalValue = cat.products.reduce((sum, p) => {
        const stockValue = p.stockBalances.reduce(
          (s, sb) => s + Number(sb.qtyOnHand) * Number(p.lastCost),
          0
        )
        return sum + stockValue
      }, 0)

      const totalMovements = cat.products.reduce(
        (sum, p) => sum + p.movementLines.length,
        0
      )

      return {
        id: cat.id,
        name: cat.name,
        productCount: cat.products.length,
        totalValue: Math.round(totalValue),
        totalMovements,
        avgTurnover: cat.products.length > 0 ? totalMovements / cat.products.length : 0,
      }
    }).sort((a, b) => b.totalValue - a.totalValue)
  },
  ['category-performance'],
  { revalidate: 600 }
)

export async function getCategoryPerformance(): Promise<ActionResult<CategoryPerformance[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const result = await getCachedCategoryPerformance()
    return { success: true, data: result }
  } catch (error) {
    console.error('Error getting category performance:', error)
    return { success: false, error: 'ไม่สามารถโหลดข้อมูลได้' }
  }
}

// ============================================
// Supplier Performance
// ============================================

export interface SupplierPerformance {
  id: string
  code: string
  name: string
  totalPOs: number
  totalValue: number
  avgLeadTime: number // days
  onTimeDeliveryRate: number // percentage
  qualityScore: number // based on returns
}

export async function getSupplierPerformance(): Promise<ActionResult<SupplierPerformance[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where: { active: true, deletedAt: null },
      include: {
        pos: {
          where: {
            status: { in: ['FULLY_RECEIVED', 'CLOSED', 'PARTIALLY_RECEIVED'] },
          },
          include: {
            grns: true,
          },
        },
      },
    })

    // Get all GRN IDs by supplier for quality calculation
    const supplierGRNs: Record<string, string[]> = {}
    for (const supplier of suppliers) {
      supplierGRNs[supplier.id] = supplier.pos.flatMap(po => po.grns.map(grn => grn.id))
    }

    // Get received quantities by supplier (from GRN lines)
    const grnLines = await prisma.gRNLine.findMany({
      where: {
        grnId: { in: Object.values(supplierGRNs).flat() },
      },
      include: {
        grn: {
          include: {
            po: true,
          },
        },
      },
    })

    // Calculate received qty per supplier
    const receivedBySupplier: Record<string, number> = {}
    for (const line of grnLines) {
      const supplierId = line.grn.po.supplierId
      receivedBySupplier[supplierId] = (receivedBySupplier[supplierId] || 0) + Number(line.qtyReceived)
    }

    // Get return movements (RETURN type) and calculate return qty
    // We link returns to suppliers through the products that were received from them
    const returnMovements = await prisma.movementLine.findMany({
      where: {
        movement: {
          type: 'RETURN',
          status: 'POSTED',
        },
      },
      include: {
        movement: true,
      },
    })

    // For simplicity, distribute returns proportionally based on supplier's share of received products
    const totalReceived = Object.values(receivedBySupplier).reduce((sum, qty) => sum + qty, 0)
    const totalReturned = returnMovements.reduce((sum, line) => sum + Number(line.qty), 0)

    const result: SupplierPerformance[] = suppliers.map((supplier) => {
      const totalValue = supplier.pos.reduce((sum, po) => sum + Number(po.total), 0)

      // Calculate average lead time
      let totalLeadTime = 0
      let completedOrders = 0
      let onTimeOrders = 0

      for (const po of supplier.pos) {
        if (po.grns.length > 0) {
          const firstGRN = po.grns.sort(
            (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
          )[0]
          
          const leadTime = Math.floor(
            (firstGRN.receivedAt.getTime() - po.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          totalLeadTime += leadTime
          completedOrders++

          // Check if on time (within ETA)
          if (po.eta && firstGRN.receivedAt <= po.eta) {
            onTimeOrders++
          } else if (!po.eta) {
            // If no ETA, consider it on time
            onTimeOrders++
          }
        }
      }

      const avgLeadTime = completedOrders > 0 ? totalLeadTime / completedOrders : 0
      const onTimeRate = completedOrders > 0 ? (onTimeOrders / completedOrders) * 100 : 100

      // Calculate Quality Score based on return rate
      // Quality Score = 100 - (Return Rate * 100)
      const supplierReceived = receivedBySupplier[supplier.id] || 0
      let qualityScore = 100

      if (supplierReceived > 0 && totalReceived > 0) {
        // Proportional return rate based on supplier's share
        const supplierShare = supplierReceived / totalReceived
        const estimatedReturns = totalReturned * supplierShare
        const returnRate = (estimatedReturns / supplierReceived) * 100
        qualityScore = Math.max(0, Math.round(100 - returnRate))
      }

      return {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        totalPOs: supplier.pos.length,
        totalValue: Math.round(totalValue),
        avgLeadTime: Math.round(avgLeadTime * 10) / 10,
        onTimeDeliveryRate: Math.round(onTimeRate),
        qualityScore,
      }
    }).filter((s) => s.totalPOs > 0)
      .sort((a, b) => b.totalValue - a.totalValue)

    return { success: true, data: result }
  } catch (error) {
    console.error('Error getting supplier performance:', error)
    return { success: false, error: 'ไม่สามารถโหลดข้อมูลได้' }
  }
}

// ============================================
// Dashboard Summary Stats
// ============================================

export interface DashboardAnalytics {
  stockValue: {
    total: number
    byCategory: { name: string; value: number }[]
  }
  movements: {
    today: number
    thisWeek: number
    thisMonth: number
  }
  alerts: {
    lowStock: number
    expiringSoon: number
    pendingPR: number
    pendingPO: number
  }
  topProducts: {
    byValue: { id: string; name: string; value: number }[]
    byMovement: { id: string; name: string; count: number }[]
  }
}

const getCachedDashboardData = unstable_cache(
  async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      stockByCategory,
      movementsToday,
      movementsWeek,
      movementsMonth,
      lowStockCount,
      expiringSoonCount,
      pendingPRCount,
      pendingPOCount,
      topByValue,
      topByMovement,
    ] = await Promise.all([
      prisma.$queryRaw<{ name: string; value: number }[]>`
        SELECT 
          COALESCE(c.name, 'ไม่มีหมวดหมู่') as name,
          COALESCE(SUM(sb.qty_on_hand * p.last_cost), 0) as value
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN stock_balances sb ON p.id = sb.product_id
        WHERE p.deleted_at IS NULL AND p.active = true
        GROUP BY c.name
        ORDER BY value DESC
        LIMIT 10
      `,
      prisma.stockMovement.count({
        where: { status: 'POSTED', postedAt: { gte: startOfDay } },
      }),
      prisma.stockMovement.count({
        where: { status: 'POSTED', postedAt: { gte: startOfWeek } },
      }),
      prisma.stockMovement.count({
        where: { status: 'POSTED', postedAt: { gte: startOfMonth } },
      }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        JOIN stock_balances sb ON p.id = sb.product_id
        WHERE p.deleted_at IS NULL 
          AND p.active = true
          AND p.reorder_point > 0
          AND sb.qty_on_hand <= p.reorder_point
      `,
      prisma.lot.count({
        where: {
          expiryDate: {
            gte: now,
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.pR.count({
        where: { status: 'SUBMITTED' },
      }),
      prisma.pO.count({
        where: { status: 'DRAFT' },
      }),
      prisma.$queryRaw<{ id: string; name: string; value: number }[]>`
        SELECT 
          p.id,
          p.name,
          COALESCE(SUM(sb.qty_on_hand * p.last_cost), 0) as value
        FROM products p
        JOIN stock_balances sb ON p.id = sb.product_id
        WHERE p.deleted_at IS NULL AND p.active = true
        GROUP BY p.id, p.name
        ORDER BY value DESC
        LIMIT 5
      `,
      prisma.$queryRaw<{ id: string; name: string; count: number }[]>`
        SELECT 
          p.id,
          p.name,
          COUNT(ml.id) as count
        FROM products p
        JOIN movement_lines ml ON p.id = ml.product_id
        JOIN stock_movements sm ON ml.movement_id = sm.id
        WHERE p.deleted_at IS NULL 
          AND sm.status = 'POSTED'
          AND sm.posted_at >= ${startOfMonth}
        GROUP BY p.id, p.name
        ORDER BY count DESC
        LIMIT 5
      `,
    ])

    const totalValue = stockByCategory.reduce((sum, c) => sum + Number(c.value), 0)

    return {
      stockValue: {
        total: Math.round(totalValue),
        byCategory: stockByCategory.map((c) => ({
          name: c.name,
          value: Math.round(Number(c.value)),
        })),
      },
      movements: {
        today: movementsToday,
        thisWeek: movementsWeek,
        thisMonth: movementsMonth,
      },
      alerts: {
        lowStock: Number(lowStockCount[0]?.count || 0),
        expiringSoon: expiringSoonCount,
        pendingPR: pendingPRCount,
        pendingPO: pendingPOCount,
      },
      topProducts: {
        byValue: topByValue.map((p) => ({
          id: p.id,
          name: p.name,
          value: Math.round(Number(p.value)),
        })),
        byMovement: topByMovement.map((p) => ({
          id: p.id,
          name: p.name,
          count: Number(p.count),
        })),
      },
    }
  },
  ['dashboard-analytics'],
  { revalidate: 300 }
)

export async function getDashboardAnalytics(): Promise<ActionResult<DashboardAnalytics>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const data = await getCachedDashboardData()
    return { success: true, data }
  } catch (error) {
    console.error('Error getting dashboard analytics:', error)
    return { success: false, error: 'ไม่สามารถโหลดข้อมูลได้' }
  }
}
