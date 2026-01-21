import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering to avoid build-time database queries
export const dynamic = 'force-dynamic'
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

interface LowStockItem {
  id: string
  productId: string
  productName: string
  productSku: string
  variantId: string | null
  variantName: string | null
  variantSku: string | null
  categoryName: string | null
  warehouseName: string | null
  locationCode: string | null
  qtyOnHand: number
  reorderPoint: number
}

async function getLowStockReport(): Promise<LowStockItem[]> {
  // Get all stock balances grouped by product/variant
  // Only include:
  // - Products without variants: stockType = STOCKED
  // - Variants: variant.stockType = STOCKED
  const stockBalances = await prisma.stockBalance.findMany({
    where: {
      product: {
        active: true,
        deletedAt: null,
      },
      OR: [
        // Products without variants: check product.stockType
        { variantId: null, product: { stockType: 'STOCKED' } },
        // Variants: check variant.stockType
        { variant: { stockType: 'STOCKED' } },
      ],
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
      variant: {
        include: {
          optionValues: {
            include: {
              optionValue: {
                include: {
                  optionType: true,
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
        include: {
          warehouse: true,
        },
      },
    },
  })

  // Group by product+variant to get total stock
  const stockMap = new Map<string, {
    productId: string
    productName: string
    productSku: string
    variantId: string | null
    variantName: string | null
    variantSku: string | null
    categoryName: string | null
    reorderPoint: number
    totalQty: number
    warehouseName: string | null
    locationCode: string | null
  }>()

  for (const sb of stockBalances) {
    const key = sb.variantId 
      ? `${sb.productId}-${sb.variantId}`
      : sb.productId

    // Get variant name from optionValues if not set
    let variantName = sb.variant?.name
    if (!variantName && sb.variant?.optionValues && sb.variant.optionValues.length > 0) {
      variantName = sb.variant.optionValues.map(ov => ov.optionValue.value).join(' / ')
    }

    // Determine reorder point (use variant's if available, otherwise product's)
    const reorderPoint = sb.variant 
      ? Number(sb.variant.reorderPoint) || Number(sb.product.reorderPoint) || 0
      : Number(sb.product.reorderPoint) || 0

    const existing = stockMap.get(key)
    if (existing) {
      existing.totalQty += Number(sb.qtyOnHand)
    } else {
      stockMap.set(key, {
        productId: sb.productId,
        productName: sb.product.name,
        productSku: sb.product.sku,
        variantId: sb.variantId,
        variantName: variantName || null,
        variantSku: sb.variant?.sku || null,
        categoryName: sb.product.category?.name || null,
        reorderPoint,
        totalQty: Number(sb.qtyOnHand),
        warehouseName: sb.location.warehouse.name,
        locationCode: sb.location.code,
      })
    }
  }

  // Also get products/variants with reorderPoint but no stock (never had movement)
  // Only include:
  // - Products without variants: stockType = STOCKED
  // - Variants: variant.stockType = STOCKED
  const productsWithNoStock = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null,
      reorderPoint: { gt: 0 },
      stockBalances: { none: {} },
      OR: [
        // Products without variants: stockType = STOCKED
        { hasVariants: false, stockType: 'STOCKED' },
        // Products with variants: at least one variant has stockType = STOCKED
        { hasVariants: true, variants: { some: { stockType: 'STOCKED', active: true, deletedAt: null } } },
      ],
    },
    include: {
      category: true,
      variants: {
        where: { active: true, deletedAt: null, stockType: 'STOCKED' }, // Only STOCKED variants
        include: {
          optionValues: {
            include: {
              optionValue: {
                include: { optionType: true },
              },
            },
            orderBy: {
              optionValue: { optionType: { displayOrder: 'asc' } },
            },
          },
        },
      },
    },
  })

  for (const product of productsWithNoStock) {
    if (product.variants.length > 0) {
      // Add each variant with 0 stock (only STOCKED variants)
      for (const variant of product.variants) {
        const key = `${product.id}-${variant.id}`
        if (!stockMap.has(key)) {
          let variantName = variant.name
          if (!variantName && variant.optionValues.length > 0) {
            variantName = variant.optionValues.map(ov => ov.optionValue.value).join(' / ')
          }
          
          stockMap.set(key, {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            variantId: variant.id,
            variantName: variantName || null,
            variantSku: variant.sku,
            categoryName: product.category?.name || null,
            reorderPoint: Number(variant.reorderPoint) || Number(product.reorderPoint) || 0,
            totalQty: 0,
            warehouseName: null,
            locationCode: null,
          })
        }
      }
    } else {
      // Product without variants
      const key = product.id
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          variantId: null,
          variantName: null,
          variantSku: null,
          categoryName: product.category?.name || null,
          reorderPoint: Number(product.reorderPoint) || 0,
          totalQty: 0,
          warehouseName: null,
          locationCode: null,
        })
      }
    }
  }

  // Filter for low stock items
  const result: LowStockItem[] = []
  for (const [key, item] of stockMap) {
    if (item.reorderPoint > 0 && item.totalQty <= item.reorderPoint) {
      result.push({
        id: key,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        variantId: item.variantId,
        variantName: item.variantName,
        variantSku: item.variantSku,
        categoryName: item.categoryName,
        warehouseName: item.warehouseName,
        locationCode: item.locationCode,
        qtyOnHand: item.totalQty,
        reorderPoint: item.reorderPoint,
      })
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
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>ตัวเลือก</TableHead>
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
                    <TableCell colSpan={9} className="text-center py-12">
                      <EmptyState
                        icon={<AlertTriangle className="w-8 h-8" />}
                        title="ไม่มีสินค้าใกล้หมด"
                        description="สินค้าทั้งหมดมียอดคงเหลือเพียงพอ"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  lowStockItems.map((item) => {
                    const qty = item.qtyOnHand
                    const rop = item.reorderPoint
                    const shortage = rop - qty
                    const level = qty === 0 ? 'critical' : qty < rop / 2 ? 'warning' : 'low'
                    const levelInfo = levelConfig[level]
                    const displaySku = item.variantSku || item.productSku

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          <Link href={`/products/${item.productId}`} className="text-[var(--accent-primary)] hover:underline">
                            {displaySku}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-[var(--text-secondary)]">
                          {item.variantName || '-'}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)]">
                          {item.categoryName || '-'}
                        </TableCell>
                        <TableCell>
                          {item.warehouseName ? (
                            <>
                              <span className="font-medium">{item.warehouseName}</span>
                              <span className="text-[var(--text-muted)] text-xs ml-2">
                                ({item.locationCode})
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
          </div>
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
