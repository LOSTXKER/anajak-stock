import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, ShoppingCart } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common'

async function getLowStockReport() {
  // Query all products with reorder point > 0
  // This includes products that never had any movement (new products)
  const products = await prisma.product.findMany({
    where: {
      reorderPoint: { gt: 0 },
      active: true,
      deletedAt: null,
    },
    include: {
      category: true,
      unit: true,
      stockBalances: {
        include: {
          location: {
            include: {
              warehouse: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Transform to include calculated total stock
  const result: Array<{
    id: string
    productId: string
    product: typeof products[0]
    location: { code: string; name: string; warehouse: { name: string } } | null
    qtyOnHand: number
    totalStock: number
  }> = []

  for (const product of products) {
    const totalStock = product.stockBalances.reduce(
      (sum, sb) => sum + Number(sb.qtyOnHand),
      0
    )
    const rop = Number(product.reorderPoint)

    // Only include if total stock <= reorder point
    if (totalStock <= rop) {
      if (product.stockBalances.length === 0) {
        // Product has no stock balance records (never had movement)
        result.push({
          id: `${product.id}-no-stock`,
          productId: product.id,
          product,
          location: null,
          qtyOnHand: 0,
          totalStock: 0,
        })
      } else {
        // Group by product and show total
        result.push({
          id: `${product.id}-total`,
          productId: product.id,
          product,
          location: product.stockBalances[0]?.location || null,
          qtyOnHand: totalStock,
          totalStock,
        })
      }
    }
  }

  // Sort by qty ascending (most critical first)
  return result.sort((a, b) => a.qtyOnHand - b.qtyOnHand)
}

const levelConfig = {
  critical: { color: 'bg-[var(--status-error-light)] text-[var(--status-error)]', label: 'หมด' },
  warning: { color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]', label: 'วิกฤต' },
  low: { color: 'bg-[var(--status-info-light)] text-[var(--status-info)]', label: 'ใกล้หมด' },
}

async function LowStockReportContent() {
  const lowStockItems = await getLowStockReport()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="สินค้าใกล้หมด"
          description={`สินค้าที่ต่ำกว่า Reorder Point - ${lowStockItems.length} รายการ`}
          icon={<AlertTriangle className="w-6 h-6" />}
        />
        <Button asChild>
          <Link href="/pr/new">
            <ShoppingCart className="w-4 h-4 mr-2" />
            สร้าง PR
          </Link>
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>คลัง / โลเคชัน</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead className="text-right">ROP</TableHead>
                <TableHead className="text-right">ขาด</TableHead>
                <TableHead className="text-center">ระดับ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <EmptyState
                      icon={<AlertTriangle className="w-8 h-8" />}
                      title="ไม่มีสินค้าใกล้หมด"
                      description="สินค้าทั้งหมดมียอดคงเหลือเพียงพอ"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                lowStockItems.map((item) => {
                  const qty = Number(item.qtyOnHand)
                  const rop = Number(item.product.reorderPoint)
                  const shortage = rop - qty
                  const level = qty === 0 ? 'critical' : qty < rop / 2 ? 'warning' : 'low'
                  const levelInfo = levelConfig[level]

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        <Link href={`/products/${item.productId}`} className="text-[var(--accent-primary)] hover:underline">
                          {item.product.sku}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.product.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {item.product.category?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {item.location ? (
                          <>
                            <span className="font-medium">{item.location.warehouse.name}</span>
                            <span className="text-[var(--text-muted)] text-xs ml-2">
                              ({item.location.code})
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">ยังไม่มีสต๊อค</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={qty === 0 ? 'text-[var(--status-error)] font-bold' : 'text-[var(--status-warning)] font-bold'}>
                          {qty.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] font-mono">
                        {rop.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-[var(--status-error)] font-mono font-semibold">
                        -{shortage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={levelInfo.color}>
                          {levelInfo.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LowStockReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <LowStockReportContent />
    </Suspense>
  )
}
