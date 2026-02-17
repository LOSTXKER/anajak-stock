import { Suspense } from 'react'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDateShort, formatDateTime } from '@/lib/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  PieChart,
  Plus,
  Package,
  TrendingUp,
  Zap,
  FileText,
  ClipboardList,
  Truck,
  Clock,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const StockValueChart = dynamic(
  () => import('@/components/charts/stock-value-chart').then(m => ({ default: m.StockValueChart })),
  { loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" /> }
)
const TopProductsChart = dynamic(
  () => import('@/components/charts/top-products-chart').then(m => ({ default: m.TopProductsChart })),
  { loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" /> }
)
const CategoryPieChart = dynamic(
  () => import('@/components/charts/category-pie-chart').then(m => ({ default: m.CategoryPieChart })),
  { loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" /> }
)
import { DashboardStats } from './dashboard-stats'
import { 
  DashboardSkeleton, 
  StatCardsSkeleton, 
  ChartSkeleton, 
  PieChartSkeleton,
  Skeleton 
} from '@/components/ui/skeleton'

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
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  // Single query to get all movements in the last 7 days
  const movements = await prisma.movementLine.findMany({
    where: {
      movement: {
        status: 'POSTED',
        postedAt: { gte: sevenDaysAgo },
      },
    },
    select: {
      qty: true,
      unitCost: true,
      movement: {
        select: { type: true, postedAt: true },
      },
    },
  })
  
  // Get current stock value as baseline
  const currentStock = await prisma.stockBalance.findMany({
    select: {
      qtyOnHand: true,
      product: {
        select: { standardCost: true },
      },
      variant: {
        select: { costPrice: true },
      },
    },
  })
  
  let currentValue = currentStock.reduce((sum, sb) => {
    const cost = Number(sb.variant?.costPrice || sb.product.standardCost || 0)
    return sum + Number(sb.qtyOnHand) * cost
  }, 0)
  
  // Build daily values by working backwards
  const dailyChanges: Record<string, number> = {}
  for (const line of movements) {
    if (!line.movement.postedAt) continue
    const dateKey = line.movement.postedAt.toISOString().split('T')[0]
    const qty = Number(line.qty)
    const cost = Number(line.unitCost)
    const type = line.movement.type
    
    if (!dailyChanges[dateKey]) dailyChanges[dateKey] = 0
    
    if (type === 'RECEIVE' || type === 'RETURN') {
      dailyChanges[dateKey] += qty * cost
    } else if (type === 'ISSUE') {
      dailyChanges[dateKey] -= qty * cost
    }
  }
  
  // Generate data for each day
  const data = []
  let runningValue = currentValue
  
  for (let i = 0; i <= 6; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    
    data.unshift({
      date: formatDateShort(date),
      value: Math.max(0, Math.round(runningValue)),
    })
    
    // Subtract today's changes to get yesterday's value
    if (dailyChanges[dateKey]) {
      runningValue -= dailyChanges[dateKey]
    }
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

// Async component for stats
async function StatsSection() {
  const stats = await getDashboardStats()
  return <DashboardStats stats={stats} />
}

// Get pending actions that need attention
async function getPendingActionsData() {
  const [grnDrafts, poApproved, poSent, prSubmitted, movementApproved, stockTakeCompleted] = await Promise.all([
    prisma.gRN.findMany({
      where: { status: 'DRAFT' },
      include: { po: { include: { supplier: true } } },
      take: 5,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pO.findMany({
      where: { status: 'APPROVED' },
      include: { supplier: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pO.findMany({
      where: { 
        status: 'SENT',
        eta: { lt: new Date() }, // Overdue
      },
      include: { supplier: true },
      take: 5,
      orderBy: { eta: 'asc' },
    }),
    prisma.pR.findMany({
      where: { status: 'SUBMITTED' },
      include: { requester: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.stockMovement.findMany({
      where: { status: 'APPROVED' },
      take: 5,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.stockTake.findMany({
      where: { status: 'COMPLETED' },
      include: { warehouse: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    grnDrafts,
    poApproved,
    poSent,
    prSubmitted,
    movementApproved,
    stockTakeCompleted,
    total: grnDrafts.length + poApproved.length + poSent.length + prSubmitted.length + movementApproved.length + stockTakeCompleted.length,
  }
}

// Async component for pending actions
async function PendingActionsSection() {
  const pending = await getPendingActionsData()

  if (pending.total === 0) {
    return null // Don't show if no pending actions
  }

  const now = new Date()
  const getDaysOld = (date: Date) => Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <Card className="border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--status-warning)]" />
          งานค้างที่ต้องดำเนินการ
        </CardTitle>
        <Badge className="bg-[var(--status-warning-light)] text-[var(--status-warning)]">
          {pending.total} รายการ
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* GRN Drafts */}
        {pending.grnDrafts.map((grn) => (
          <Link
            key={grn.id}
            href={`/grn/${grn.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--status-warning-light)] flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-[var(--status-warning)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  GRN {grn.grnNumber} รอบันทึกสต๊อค
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {grn.po.supplier.name}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[var(--status-warning)] border-[var(--status-warning)]">
              {getDaysOld(grn.createdAt)} วัน
            </Badge>
          </Link>
        ))}

        {/* PO Approved - waiting to send */}
        {pending.poApproved.map((po) => (
          <Link
            key={po.id}
            href={`/po/${po.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--status-warning-light)] flex items-center justify-center">
                <FileText className="w-4 h-4 text-[var(--status-warning)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  PO {po.poNumber} รอส่งให้ Supplier
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {po.supplier.name}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[var(--status-warning)] border-[var(--status-warning)]">
              {getDaysOld(po.createdAt)} วัน
            </Badge>
          </Link>
        ))}

        {/* PO Sent - overdue */}
        {pending.poSent.map((po) => (
          <Link
            key={po.id}
            href={`/po/${po.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--status-error)]/30 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--status-error-light)] flex items-center justify-center">
                <Truck className="w-4 h-4 text-[var(--status-error)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  PO {po.poNumber} เลย ETA
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {po.supplier.name}
                </p>
              </div>
            </div>
            <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)]">
              เลย {po.eta ? getDaysOld(po.eta) : 0} วัน
            </Badge>
          </Link>
        ))}

        {/* PR Submitted - waiting approval */}
        {pending.prSubmitted.map((pr) => (
          <Link
            key={pr.id}
            href={`/pr/${pr.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--status-info-light)] flex items-center justify-center">
                <Clock className="w-4 h-4 text-[var(--status-info)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  PR {pr.prNumber} รออนุมัติ
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  จาก {pr.requester.name}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[var(--status-info)] border-[var(--status-info)]">
              {getDaysOld(pr.createdAt)} วัน
            </Badge>
          </Link>
        ))}

        {/* Movement Approved - waiting post */}
        {pending.movementApproved.map((mov) => (
          <Link
            key={mov.id}
            href={`/movements/${mov.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--status-warning-light)] flex items-center justify-center">
                <Package className="w-4 h-4 text-[var(--status-warning)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  {mov.docNumber} รอบันทึก
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {mov.type}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[var(--status-warning)] border-[var(--status-warning)]">
              {getDaysOld(mov.createdAt)} วัน
            </Badge>
          </Link>
        ))}

        {/* Stock Take Completed - waiting approval */}
        {pending.stockTakeCompleted.map((st) => (
          <Link
            key={st.id}
            href={`/stock-take/${st.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--status-info-light)] flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-[var(--status-info)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  ตรวจนับ {st.code} รออนุมัติ
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {st.warehouse.name}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[var(--status-info)] border-[var(--status-info)]">
              {getDaysOld(st.completedAt || st.createdAt)} วัน
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

// Async component for low stock items
async function LowStockSection() {
  const lowStockItems = await getLowStockItems()
  
  return (
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
  )
}

// Async component for recent movements
async function RecentMovementsSection() {
  const recentMovements = await getRecentMovements()
  
  return (
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
                  {formatDateTime(movement.createdAt, {
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
  )
}

// Async component for stock value chart
async function StockValueChartSection() {
  const stockValueTrend = await getStockValueTrend()
  
  return (
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
  )
}

// Async component for category pie chart
async function CategoryChartSection() {
  const stockByCategory = await getStockByCategory()
  
  return (
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
  )
}

// Async component for top products chart
async function TopProductsSection() {
  const topProducts = await getTopMovedProducts()
  
  return (
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
  )
}

// Card skeleton for lists
function CardListSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome Header - renders immediately */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
            สวัสดี, {session?.name || 'User'}
          </h1>
          <p className="text-sm md:text-base text-[var(--text-secondary)] mt-1">
            ยินดีต้อนรับสู่ระบบจัดการสต๊อคสินค้า
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" asChild>
            <Link href="/movements/new">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">เพิ่มเคลื่อนไหว</span>
              <span className="sm:hidden">เคลื่อนไหว</span>
            </Link>
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" asChild>
            <Link href="/products/new">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">เพิ่มสินค้า</span>
              <span className="sm:hidden">สินค้า</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid - Suspense boundary */}
      <Suspense fallback={<StatCardsSkeleton count={6} />}>
        <StatsSection />
      </Suspense>

      {/* Pending Actions - Show first if there are any */}
      <Suspense fallback={null}>
        <PendingActionsSection />
      </Suspense>

      {/* Content Grid - Each with own Suspense boundary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Suspense fallback={<CardListSkeleton />}>
          <LowStockSection />
        </Suspense>
        
        <Suspense fallback={<CardListSkeleton />}>
          <RecentMovementsSection />
        </Suspense>
      </div>

      {/* Charts Section - Each with own Suspense boundary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Suspense fallback={<ChartSkeleton height={250} />}>
          <StockValueChartSection />
        </Suspense>
        
        <Suspense fallback={<PieChartSkeleton />}>
          <CategoryChartSection />
        </Suspense>
      </div>

      {/* Top Products Chart - Suspense boundary */}
      <Suspense fallback={<ChartSkeleton height={300} />}>
        <TopProductsSection />
      </Suspense>
    </div>
  )
}
