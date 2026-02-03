'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// ==================== TOP ISSUE PRODUCTS ====================

export async function getTopIssueProducts(days: number = 30, limit: number = 10) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get movements with type ISSUE and status POSTED in the date range
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'ISSUE',
        status: 'POSTED',
        createdAt: { gte: startDate },
      },
      include: {
        lines: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    })

    // Aggregate by product
    const productMap = new Map<string, {
      productId: string
      sku: string
      name: string
      category: string | null
      totalQty: number
      issueCount: number
    }>()

    for (const movement of movements) {
      for (const line of movement.lines) {
        const existing = productMap.get(line.productId)
        const qty = Number(line.qty)
        
        if (existing) {
          existing.totalQty += qty
          existing.issueCount += 1
        } else {
          productMap.set(line.productId, {
            productId: line.productId,
            sku: line.product.sku,
            name: line.product.name,
            category: line.product.category?.name || null,
            totalQty: qty,
            issueCount: 1,
          })
        }
      }
    }

    // Convert to array and sort by totalQty descending
    const result = Array.from(productMap.values())
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, limit)

    return { success: true as const, data: result }
  } catch (error) {
    console.error('Error getting top issue products:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

// ==================== DEAD STOCK REPORT ====================

export async function getDeadStock(days: number = 60, limit: number = 50) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get all products with stock balance > 0
    const productsWithStock = await prisma.product.findMany({
      where: {
        deletedAt: null,
        stockBalances: {
          some: {
            qtyOnHand: { gt: 0 },
          },
        },
      },
      include: {
        category: true,
        stockBalances: true,
      },
    })

    // For each product, check last movement date
    const deadStockItems = []

    for (const product of productsWithStock) {
      const lastMovement = await prisma.movementLine.findFirst({
        where: {
          productId: product.id,
          movement: {
            status: 'POSTED',
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          movement: true,
        },
      })

      const lastMoveDate = lastMovement?.createdAt || product.createdAt
      const totalStock = product.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)
      const stockValue = totalStock * Number(product.standardCost)

      // If last movement is before cutoff date, it's dead stock
      if (lastMoveDate < cutoffDate && totalStock > 0) {
        const daysSinceMove = Math.floor((Date.now() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24))
        
        deadStockItems.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category?.name || null,
          totalStock,
          stockValue,
          lastMovementDate: lastMoveDate,
          daysSinceMove,
        })
      }
    }

    // Sort by days since move descending (oldest first)
    const result = deadStockItems
      .sort((a, b) => b.daysSinceMove - a.daysSinceMove)
      .slice(0, limit)

    return { success: true as const, data: result }
  } catch (error) {
    console.error('Error getting dead stock:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

// ==================== SUPPLIER LEAD TIME ====================

export async function getSupplierLeadTime() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    // Get all GRNs with their POs
    const grns = await prisma.gRN.findMany({
      where: {
        status: 'POSTED',
        poId: { not: '' },
      },
      include: {
        po: {
          include: {
            supplier: true,
          },
        },
      },
    })

    // Group by supplier and calculate lead times
    const supplierMap = new Map<string, {
      supplierId: string
      supplierName: string
      poCount: number
      leadTimes: number[]
    }>()

    for (const grn of grns) {
      if (!grn.po || !grn.po.supplier) continue
      
      const supplierId = grn.po.supplierId
      const leadTime = Math.floor(
        (grn.receivedAt.getTime() - grn.po.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )

      const existing = supplierMap.get(supplierId)
      if (existing) {
        existing.poCount += 1
        existing.leadTimes.push(leadTime)
      } else {
        supplierMap.set(supplierId, {
          supplierId,
          supplierName: grn.po.supplier.name,
          poCount: 1,
          leadTimes: [leadTime],
        })
      }
    }

    // Calculate stats for each supplier
    const result = Array.from(supplierMap.values()).map(supplier => {
      const leadTimes = supplier.leadTimes
      const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      const minLeadTime = Math.min(...leadTimes)
      const maxLeadTime = Math.max(...leadTimes)

      return {
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        poCount: supplier.poCount,
        avgLeadTime: Math.round(avgLeadTime),
        minLeadTime,
        maxLeadTime,
      }
    })

    // Sort by avgLeadTime ascending (fastest first)
    result.sort((a, b) => a.avgLeadTime - b.avgLeadTime)

    return { success: true as const, data: result }
  } catch (error) {
    console.error('Error getting supplier lead time:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

// ==================== PR TO PO CYCLE TIME ====================

export async function getPRtoPOCycleTime(days: number = 90) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get PRs that have been converted to PO
    const prs = await prisma.pR.findMany({
      where: {
        status: 'CONVERTED',
        createdAt: { gte: startDate },
      },
      include: {
        pos: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    })

    // Calculate cycle times
    const cycleTimes: number[] = []
    const details: {
      prId: string
      prCode: string
      prDate: Date
      poDate: Date | null
      cycleTime: number | null
    }[] = []

    for (const pr of prs) {
      const firstPO = pr.pos[0]
      if (firstPO) {
        const cycleTime = Math.floor(
          (firstPO.createdAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        cycleTimes.push(cycleTime)
        details.push({
          prId: pr.id,
          prCode: pr.prNumber,
          prDate: pr.createdAt,
          poDate: firstPO.createdAt,
          cycleTime,
        })
      }
    }

    // Calculate stats
    const avgCycleTime = cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
      : 0
    const minCycleTime = cycleTimes.length > 0 ? Math.min(...cycleTimes) : 0
    const maxCycleTime = cycleTimes.length > 0 ? Math.max(...cycleTimes) : 0

    // Distribution by cycle time ranges
    const distribution = {
      sameDay: cycleTimes.filter(t => t === 0).length,
      oneDay: cycleTimes.filter(t => t === 1).length,
      twoToThreeDays: cycleTimes.filter(t => t >= 2 && t <= 3).length,
      fourToSevenDays: cycleTimes.filter(t => t >= 4 && t <= 7).length,
      moreThanWeek: cycleTimes.filter(t => t > 7).length,
    }

    return {
      success: true as const,
      data: {
        totalPRs: prs.length,
        convertedPRs: cycleTimes.length,
        avgCycleTime,
        minCycleTime,
        maxCycleTime,
        distribution,
        details: details.sort((a, b) => (b.cycleTime || 0) - (a.cycleTime || 0)),
      },
    }
  } catch (error) {
    console.error('Error getting PR to PO cycle time:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

// ==================== FORECAST ====================

export async function getForecast(months: number = 3) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // Get all issue movements in the period
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'ISSUE',
        status: 'POSTED',
        createdAt: { gte: startDate },
      },
      include: {
        lines: {
          include: {
            product: {
              include: {
                category: true,
                stockBalances: true,
              },
            },
          },
        },
      },
    })

    // Aggregate by product and month
    const productMonthlyUsage = new Map<string, {
      product: {
        id: string
        sku: string
        name: string
        category: string | null
        reorderPoint: number
        currentStock: number
        standardCost: number
      }
      monthlyUsage: number[]
    }>()

    for (const movement of movements) {
      for (const line of movement.lines) {
        const monthKey = movement.createdAt.toISOString().substring(0, 7) // YYYY-MM
        
        let existing = productMonthlyUsage.get(line.productId)
        if (!existing) {
          const totalStock = line.product.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)
          existing = {
            product: {
              id: line.productId,
              sku: line.product.sku,
              name: line.product.name,
              category: line.product.category?.name || null,
              reorderPoint: Number(line.product.reorderPoint),
              currentStock: totalStock,
              standardCost: Number(line.product.standardCost),
            },
            monthlyUsage: [],
          }
          productMonthlyUsage.set(line.productId, existing)
        }
      }
    }

    // Calculate moving average and forecast
    const result = Array.from(productMonthlyUsage.values()).map(item => {
      const totalUsage = item.monthlyUsage.reduce((a, b) => a + b, 0)
      const avgMonthlyUsage = totalUsage / months
      const forecastNextMonth = avgMonthlyUsage
      const daysOfSupply = avgMonthlyUsage > 0
        ? Math.round((item.product.currentStock / avgMonthlyUsage) * 30)
        : 999

      return {
        ...item.product,
        avgMonthlyUsage: Math.round(avgMonthlyUsage),
        forecastNextMonth: Math.round(forecastNextMonth),
        daysOfSupply,
        suggestedOrder: Math.max(0, Math.round(forecastNextMonth - item.product.currentStock + item.product.reorderPoint)),
      }
    })

    // Sort by days of supply ascending (urgent first)
    result.sort((a, b) => a.daysOfSupply - b.daysOfSupply)

    return { success: true as const, data: result }
  } catch (error) {
    console.error('Error getting forecast:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

// ==================== ORDER SUMMARY REPORT ====================

export interface OrderSummaryItem {
  orderRef: string
  firstIssueDate: Date
  lastIssueDate: Date
  itemCount: number
  totalQty: number
  items: {
    productId: string
    variantId: string | null
    sku: string
    productName: string
    variantName: string | null
    qty: number
    movementDocNumber: string
    issuedAt: Date
  }[]
}

export interface OrderSummaryData {
  totalOrders: number
  totalItems: number
  totalQty: number
  orders: OrderSummaryItem[]
}

export async function getOrderSummaryReport(params: {
  dateFrom?: string
  dateTo?: string
  search?: string
}): Promise<{ success: true; data: OrderSummaryData } | { success: false; error: string }> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const { dateFrom, dateTo, search } = params

    // Query movement lines with orderRef
    const movementLines = await prisma.movementLine.findMany({
      where: {
        orderRef: search 
          ? { contains: search, mode: 'insensitive' }
          : { not: null },
        movement: {
          type: 'ISSUE',
          status: 'POSTED',
          ...((dateFrom || dateTo) && {
            postedAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo + 'T23:59:59.999Z') }),
            },
          }),
        },
      },
      include: {
        product: {
          select: { id: true, sku: true, name: true },
        },
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
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
        movement: {
          select: {
            id: true,
            docNumber: true,
            postedAt: true,
          },
        },
      },
      orderBy: {
        movement: { postedAt: 'desc' },
      },
    })

    // Group by orderRef
    const orderMap = new Map<string, {
      orderRef: string
      firstIssueDate: Date
      lastIssueDate: Date
      items: {
        productId: string
        variantId: string | null
        sku: string
        productName: string
        variantName: string | null
        qty: number
        movementDocNumber: string
        issuedAt: Date
      }[]
    }>()

    for (const line of movementLines) {
      if (!line.orderRef) continue

      const variantName = line.variant?.optionValues
        ?.map((ov) => ov.optionValue.value)
        .join(' / ') || line.variant?.name || null

      const item = {
        productId: line.productId,
        variantId: line.variantId,
        sku: line.variant?.sku || line.product.sku,
        productName: line.product.name,
        variantName,
        qty: Number(line.qty),
        movementDocNumber: line.movement.docNumber,
        issuedAt: line.movement.postedAt || new Date(),
      }

      const existing = orderMap.get(line.orderRef)
      if (existing) {
        existing.items.push(item)
        if (item.issuedAt < existing.firstIssueDate) {
          existing.firstIssueDate = item.issuedAt
        }
        if (item.issuedAt > existing.lastIssueDate) {
          existing.lastIssueDate = item.issuedAt
        }
      } else {
        orderMap.set(line.orderRef, {
          orderRef: line.orderRef,
          firstIssueDate: item.issuedAt,
          lastIssueDate: item.issuedAt,
          items: [item],
        })
      }
    }

    // Convert to array and calculate totals
    const orders: OrderSummaryItem[] = Array.from(orderMap.values()).map(order => ({
      ...order,
      itemCount: order.items.length,
      totalQty: order.items.reduce((sum, item) => sum + item.qty, 0),
    }))

    // Sort by lastIssueDate descending (most recent first)
    orders.sort((a, b) => b.lastIssueDate.getTime() - a.lastIssueDate.getTime())

    // Calculate summary
    const totalOrders = orders.length
    const totalItems = orders.reduce((sum, order) => sum + order.itemCount, 0)
    const totalQty = orders.reduce((sum, order) => sum + order.totalQty, 0)

    return {
      success: true,
      data: {
        totalOrders,
        totalItems,
        totalQty,
        orders,
      },
    }
  } catch (error) {
    console.error('Error getting order summary:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}
