'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface ForecastResult {
  productId: string
  sku: string
  name: string
  category: string | null
  currentStock: number
  reorderPoint: number
  monthlyUsage: number[]
  avgMonthlyUsage: number
  forecastNextMonth: number
  daysOfSupply: number
  suggestedOrder: number
  trend: 'up' | 'down' | 'stable'
}

export async function getProductForecast(months: number = 6, categoryId?: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    // Get date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // Get products with stock
    const productsWhere: {
      deletedAt: null
      active: boolean
      categoryId?: string
    } = {
      deletedAt: null,
      active: true,
    }
    
    if (categoryId) {
      productsWhere.categoryId = categoryId
    }

    const products = await prisma.product.findMany({
      where: productsWhere,
      include: {
        category: true,
        stockBalances: true,
      },
    })

    // Get all issue movements in the period
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'ISSUE',
        status: 'POSTED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        lines: true,
      },
    })

    // Build monthly usage map per product
    const productUsage = new Map<string, Map<string, number>>() // productId -> month -> qty

    for (const movement of movements) {
      const monthKey = movement.createdAt.toISOString().substring(0, 7) // YYYY-MM
      
      for (const line of movement.lines) {
        if (!productUsage.has(line.productId)) {
          productUsage.set(line.productId, new Map())
        }
        const monthMap = productUsage.get(line.productId)!
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Number(line.qty))
      }
    }

    // Generate month keys for the period
    const monthKeys: string[] = []
    const tempDate = new Date(startDate)
    while (tempDate <= endDate) {
      monthKeys.push(tempDate.toISOString().substring(0, 7))
      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    // Calculate forecast for each product
    const results: ForecastResult[] = []

    for (const product of products) {
      const usageMap = productUsage.get(product.id) || new Map()
      
      // Get monthly usage array
      const monthlyUsage = monthKeys.map(month => usageMap.get(month) || 0)
      
      // Calculate average
      const totalUsage = monthlyUsage.reduce((a, b) => a + b, 0)
      const avgMonthlyUsage = totalUsage / months

      // Simple moving average forecast (use last 3 months if available)
      const recentMonths = monthlyUsage.slice(-3)
      const forecastNextMonth = recentMonths.length > 0
        ? recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length
        : avgMonthlyUsage

      // Current stock
      const currentStock = product.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)

      // Days of supply
      const dailyUsage = avgMonthlyUsage / 30
      const daysOfSupply = dailyUsage > 0
        ? Math.round(currentStock / dailyUsage)
        : 999

      // Suggested order (to meet 2 months of supply)
      const targetStock = forecastNextMonth * 2
      const suggestedOrder = Math.max(0, Math.round(targetStock - currentStock))

      // Trend calculation (compare first half vs second half)
      const firstHalf = monthlyUsage.slice(0, Math.floor(monthlyUsage.length / 2))
      const secondHalf = monthlyUsage.slice(Math.floor(monthlyUsage.length / 2))
      const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
      const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0
      
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (secondHalfAvg > firstHalfAvg * 1.1) {
        trend = 'up'
      } else if (secondHalfAvg < firstHalfAvg * 0.9) {
        trend = 'down'
      }

      // Only include products with usage or stock
      if (totalUsage > 0 || currentStock > 0) {
        results.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category?.name || null,
          currentStock,
          reorderPoint: Number(product.reorderPoint),
          monthlyUsage,
          avgMonthlyUsage: Math.round(avgMonthlyUsage),
          forecastNextMonth: Math.round(forecastNextMonth),
          daysOfSupply,
          suggestedOrder,
          trend,
        })
      }
    }

    // Sort by days of supply (urgent first)
    results.sort((a, b) => a.daysOfSupply - b.daysOfSupply)

    return { success: true as const, data: results }
  } catch (error) {
    console.error('Error calculating forecast:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการคำนวณ' }
  }
}

export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: 'asc' },
    })
    return { success: true as const, data: categories }
  } catch (error) {
    console.error('Error getting categories:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}

export async function getProductUsageHistory(productId: string, months: number = 12) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // Get product info
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        stockBalances: true,
      },
    })

    if (!product) {
      return { success: false as const, error: 'ไม่พบสินค้า' }
    }

    // Get all movements for this product
    const movements = await prisma.movementLine.findMany({
      where: {
        productId,
        movement: {
          status: 'POSTED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        movement: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Generate month keys
    const monthKeys: string[] = []
    const tempDate = new Date(startDate)
    while (tempDate <= endDate) {
      monthKeys.push(tempDate.toISOString().substring(0, 7))
      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    // Group by month and type
    const monthlyData = new Map<string, { receive: number; issue: number }>()
    
    for (const key of monthKeys) {
      monthlyData.set(key, { receive: 0, issue: 0 })
    }

    for (const line of movements) {
      const monthKey = line.createdAt.toISOString().substring(0, 7)
      const data = monthlyData.get(monthKey)
      if (data) {
        const qty = Number(line.qty)
        if (line.movement.type === 'RECEIVE') {
          data.receive += qty
        } else if (line.movement.type === 'ISSUE') {
          data.issue += qty
        }
      }
    }

    // Convert to array
    const history = monthKeys.map(month => ({
      month,
      receive: monthlyData.get(month)?.receive || 0,
      issue: monthlyData.get(month)?.issue || 0,
    }))

    const currentStock = product.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)

    return {
      success: true as const,
      data: {
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category?.name || null,
          currentStock,
          reorderPoint: Number(product.reorderPoint),
        },
        history,
      },
    }
  } catch (error) {
    console.error('Error getting product usage history:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}
