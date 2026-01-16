import { Suspense } from 'react'
import Link from 'next/link'
import { getStockBalances, getWarehouses, getStockSummary } from '@/actions/stock'
import { getCategories } from '@/actions/products'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Warehouse, Package, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, FileDown } from 'lucide-react'
import { StockSearch } from './stock-search'
import { PageHeader, StatCard, StatCardGrid, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'
import { ExportButton } from '@/components/export-button'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    warehouse?: string
    category?: string
    lowStock?: string
  }>
}

async function StockContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const warehouseId = params.warehouse || ''
  const categoryId = params.category || ''
  const lowStockOnly = params.lowStock === 'true'

  const [
    { items: stockBalances, total, totalPages },
    warehouses,
    categories,
    summary,
  ] = await Promise.all([
    getStockBalances({
      page,
      limit: 20,
      search,
      warehouseId: warehouseId || undefined,
      categoryId: categoryId || undefined,
      lowStockOnly,
    }),
    getWarehouses(),
    getCategories(),
    getStockSummary(),
  ])

  // Build pagination URL
  const buildUrl = (newPage: number) => {
    const params = new URLSearchParams()
    params.set('page', newPage.toString())
    if (search) params.set('search', search)
    if (warehouseId) params.set('warehouse', warehouseId)
    if (categoryId) params.set('category', categoryId)
    if (lowStockOnly) params.set('lowStock', 'true')
    return `/stock?${params.toString()}`
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="คลังสินค้า"
        description="ดูยอดคงเหลือสินค้าตามโลเคชัน"
        icon={<Warehouse className="w-6 h-6" />}
        actions={
          <ExportButton
            endpoint="/api/export/stock"
            label="Export"
            className="hidden sm:inline-flex"
          />
        }
      />

      {/* Summary Cards */}
      <StatCardGrid>
        <StatCard
          title="จำนวนสินค้า"
          value={summary.productCount.toLocaleString()}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="มูลค่าสต๊อครวม"
          value={`฿${summary.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="สินค้าใกล้หมด"
          value={summary.lowStockCount.toString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="warning"
          href="/reports/low-stock"
        />
      </StatCardGrid>

      {/* Search & Filter */}
      <StockSearch warehouses={warehouses} categories={categories} />

      {/* Stock Table */}
      <Card>
        <CardHeader className="border-b border-[var(--border-default)] py-4">
          <CardTitle className="text-base font-semibold">
            ยอดคงเหลือ ({total.toLocaleString()} รายการ)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stockBalances.length === 0 ? (
            <EmptyState
              icon={<Package className="w-12 h-12" />}
              title="ไม่พบข้อมูลสต๊อค"
              description="ลองเปลี่ยนเงื่อนไขการค้นหา หรือเพิ่มการเคลื่อนไหวสินค้า"
            />
          ) : (
            <div className="overflow-x-auto mobile-scroll">
              <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>คลัง</TableHead>
                  <TableHead>โลเคชัน</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead className="text-right">ROP</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockBalances.map((balance) => {
                  const isLowStock =
                    Number(balance.product.reorderPoint) > 0 &&
                    Number(balance.qtyOnHand) <= Number(balance.product.reorderPoint)

                  return (
                    <TableRow key={balance.id}>
                      <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                        {balance.product.sku}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/products/${balance.product.id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
                        >
                          {balance.product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {balance.product.category?.name || '-'}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {balance.location.warehouse.name}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-[var(--text-primary)]">
                          {balance.location.code}
                        </span>
                        <span className="text-[var(--text-muted)] text-xs ml-2">
                          {balance.location.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-bold ${
                            isLowStock ? 'text-[var(--status-warning)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {Number(balance.qtyOnHand).toLocaleString()}
                        </span>
                        <span className="text-[var(--text-muted)] text-sm ml-1">
                          {balance.product.unit?.code || ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)]">
                        {Number(balance.product.reorderPoint).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={
                            isLowStock
                              ? 'bg-[var(--status-warning-light)] text-[var(--status-warning)]'
                              : 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                          }
                        >
                          {isLowStock ? 'ใกล้หมด' : 'ปกติ'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={buildUrl(page - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                ก่อนหน้า
              </Link>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                ก่อนหน้า
              </>
            )}
          </Button>
          <span className="text-[var(--text-secondary)] text-sm px-4">
            หน้า {page} จาก {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={buildUrl(page + 1)}>
                ถัดไป
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            ) : (
              <>
                ถัดไป
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function StockPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={true} />}>
      <StockContent {...props} />
    </Suspense>
  )
}
