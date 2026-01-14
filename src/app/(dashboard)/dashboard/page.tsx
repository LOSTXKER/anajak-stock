import { Suspense } from 'react'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  PieChart,
  ArrowRight,
  Plus,
  Package,
  TrendingUp,
} from 'lucide-react'
import { StockValueChart } from '@/components/charts/stock-value-chart'
import { TopProductsChart } from '@/components/charts/top-products-chart'
import { CategoryPieChart } from '@/components/charts/category-pie-chart'
import { Spinner } from '@/components/common'
import { DashboardStats } from './dashboard-stats'

async function getDashboardStats() {
  const [
    totalProducts,
    totalLocations,
    lowStockProducts,
    pendingPRs,
    pendingPOs,
    recentMovements,
    stockValue,
  ] = await Promise.all([
    prisma.product.count({ where: { active: true, deletedAt: null } }),
    prisma.location.count({ where: { active: true, deletedAt: null } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT sb."productId") as count
      FROM stock_balances sb
      JOIN products p ON sb."productId" = p.id
      WHERE sb."qtyOnHand" <= p."reorderPoint"
      AND p."reorderPoint" > 0
      AND p.active = true
      AND p."deletedAt" IS NULL
    `,
    prisma.pR.count({ where: { status: 'SUBMITTED' } }),
    prisma.pO.count({ where: { status: { in: ['APPROVED', 'SENT', 'IN_PROGRESS'] } } }),
    prisma.stockMovement.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.stockBalance.aggregate({
      _sum: {
        qtyOnHand: true,
      },
    }),
  ])

  return {
    totalProducts,
    totalLocations,
    lowStockCount: Number(lowStockProducts[0]?.count ?? 0),
    pendingPRs,
    pendingPOs,
    todayMovements: recentMovements,
    totalStockQty: Number(stockValue._sum.qtyOnHand ?? 0),
  }
}

async function getLowStockItems() {
  const items = await prisma.stockBalance.findMany({
    where: {
      product: {
        reorderPoint: { gt: 0 },
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
      location: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: {
      qtyOnHand: 'asc',
    },
    take: 5,
  })

  return items.filter(
    (item) => Number(item.qtyOnHand) <= Number(item.product.reorderPoint)
  )
}

async function getRecentMovements() {
  return prisma.stockMovement.findMany({
    where: { status: 'POSTED' },
    include: {
      createdBy: {
        select: { id: true, name: true, username: true, role: true },
      },
      lines: {
        include: {
          product: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
}

async function getTopMovedProducts() {
  const results = await prisma.movementLine.groupBy({
    by: ['productId'],
    _sum: {
      qty: true,
    },
    orderBy: {
      _sum: {
        qty: 'desc',
      },
    },
    take: 10,
  })

  const productIds = results.map((r) => r.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  })

  const productMap = new Map(products.map((p) => [p.id, p.name]))

  return results.map((r) => ({
    name: productMap.get(r.productId) || 'Unknown',
    qty: Number(r._sum.qty) || 0,
  }))
}

async function getStockByCategory() {
  const stockData = await prisma.stockBalance.findMany({
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  })

  const byCategory: Record<string, number> = {}
  for (const item of stockData) {
    const catName = item.product.category?.name || 'ไม่มีหมวดหมู่'
    const value = Number(item.qtyOnHand) * Number(item.product.standardCost)
    byCategory[catName] = (byCategory[catName] || 0) + value
  }

  return Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

async function getStockValueTrend() {
  const today = new Date()
  const data = []
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    date.setHours(23, 59, 59, 999) // End of day
    
    // Calculate stock value up to this date based on movements
    const movements = await prisma.movementLine.findMany({
      where: {
        movement: {
          status: 'POSTED',
          postedAt: { lte: date },
        },
      },
      select: {
        qty: true,
        unitCost: true,
        movement: {
          select: { type: true },
        },
      },
    })
    
    let totalValue = 0
    for (const line of movements) {
      const qty = Number(line.qty)
      const cost = Number(line.unitCost)
      const type = line.movement.type
      
      if (type === 'RECEIVE' || type === 'RETURN') {
        totalValue += qty * cost
      } else if (type === 'ISSUE') {
        totalValue -= qty * cost
      }
      // TRANSFER and ADJUST don't change total value
    }
    
    data.push({
      date: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      value: Math.max(0, totalValue),
    })
  }
  
  return data
}

function MovementTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    RECEIVE: {
      bg: 'bg-[var(--status-success-light)]',
      text: 'text-[var(--status-success)]',
      label: 'รับเข้า',
    },
    ISSUE: {
      bg: 'bg-[var(--status-error-light)]',
      text: 'text-[var(--status-error)]',
      label: 'เบิกออก',
    },
    TRANSFER: {
      bg: 'bg-[var(--status-info-light)]',
      text: 'text-[var(--status-info)]',
      label: 'โอนย้าย',
    },
    ADJUST: {
      bg: 'bg-[var(--status-warning-light)]',
      text: 'text-[var(--status-warning)]',
      label: 'ปรับยอด',
    },
    RETURN: {
      bg: 'bg-[var(--accent-light)]',
      text: 'text-[var(--accent-primary)]',
      label: 'คืนของ',
    },
  }

  const style = config[type] || config.ADJUST

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  )
}

async function DashboardContent() {
  const [session, stats, lowStockItems, recentMovements, topProducts, stockByCategory, stockValueTrend] = await Promise.all([
    getSession(),
    getDashboardStats(),
    getLowStockItems(),
    getRecentMovements(),
    getTopMovedProducts(),
    getStockByCategory(),
    getStockValueTrend(),
  ])

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            สวัสดี, {session?.name || 'User'}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            ยินดีต้อนรับสู่ระบบจัดการสต๊อคสินค้า
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/movements/new">
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มเคลื่อนไหว
            </Link>
          </Button>
          <Button asChild>
            <Link href="/products/new">
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มสินค้า
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <DashboardStats stats={stats} />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--status-warning)]" />
              สินค้าใกล้หมด
            </CardTitle>
            <Badge variant="secondary" className="bg-[var(--status-warning-light)] text-[var(--status-warning)]">
              {lowStockItems.length} รายการ
            </Badge>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-[var(--status-success-light)] flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-[var(--status-success)]" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  ไม่มีสินค้าใกล้หมดในขณะนี้
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)] text-sm">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.product.sku} • {item.location.warehouse.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--status-warning)]">
                        {Number(item.qtyOnHand).toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        ROP: {Number(item.product.reorderPoint).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                <Link
                  href="/reports/low-stock"
                  className="flex items-center justify-center gap-1 text-sm text-[var(--accent-primary)] hover:underline pt-2"
                >
                  ดูทั้งหมด
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
              เคลื่อนไหวล่าสุด
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/movements">ดูทั้งหมด</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-[var(--text-muted)]" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  ยังไม่มีการเคลื่อนไหว
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMovements.map((movement) => (
                  <Link
                    key={movement.id}
                    href={`/movements/${movement.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MovementTypeBadge type={movement.type} />
                      <div>
                        <p className="font-medium text-[var(--text-primary)] text-sm">
                          {movement.docNumber}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {movement.createdBy.name}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(movement.createdAt).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Value Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
              แนวโน้มมูลค่าสต๊อค (7 วัน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StockValueChart data={stockValueTrend} />
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[var(--accent-primary)]" />
              สต๊อคตามหมวดหมู่
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockByCategory.length > 0 ? (
              <CategoryPieChart data={stockByCategory} />
            ) : (
              <div className="text-center py-8">
                <p className="text-[var(--text-muted)] text-sm">ไม่มีข้อมูล</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--accent-primary)]" />
            Top 10 สินค้าที่เคลื่อนไหวมากที่สุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <TopProductsChart data={topProducts} />
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--text-muted)] text-sm">ไม่มีข้อมูล</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner className="w-8 h-8" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
