import { Suspense } from 'react'
import Link from 'next/link'
import { getProducts, getCategories } from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Package, Plus, Search, Layers, FileUp, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { ProductSearch } from './product-search'
import { ProductActions } from './product-actions'
import { ExportButton } from '@/components/export-button'
import { PageHeader, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    category?: string
    itemType?: string
  }>
}

const ITEM_TYPE_TABS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'FINISHED_GOOD', label: 'สินค้าสำเร็จรูป' },
  { value: 'RAW_MATERIAL', label: 'วัตถุดิบ' },
  { value: 'CONSUMABLE', label: 'วัสดุสิ้นเปลือง' },
] as const

async function ProductsContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const categoryId = params.category || ''
  const itemType = params.itemType || ''

  const [{ items: products, total, totalPages }, categories] = await Promise.all([
    getProducts({ page, limit: 20, search, categoryId: categoryId || undefined, itemType: itemType || undefined }),
    getCategories(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="สินค้า"
        description={`จัดการข้อมูลสินค้าทั้งหมด ${total.toLocaleString()} รายการ`}
        icon={<Package className="w-6 h-6" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButton
              endpoint="/api/export/products"
              label="Export"
              className="hidden sm:inline-flex"
            />
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href="/products/bulk-stock-type">
                <Settings2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">จัดการสต๊อค</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href="/products/import">
                <FileUp className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">นำเข้า CSV</span>
              </Link>
            </Button>
            <Button size="sm" className="text-xs sm:text-sm" asChild>
              <Link href="/products/new">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">เพิ่มสินค้า</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Item Type Tabs */}
      <ItemTypeTabs current={itemType} search={search} categoryId={categoryId} />

      {/* Search & Filter */}
      <ProductSearch categories={categories} />

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <EmptyState
              icon={<Search className="w-12 h-12" />}
              title="ไม่พบสินค้า"
              description="ลองเปลี่ยนเงื่อนไขการค้นหา หรือเพิ่มสินค้าใหม่"
              action={
                <Button asChild>
                  <Link href="/products/new">
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มสินค้า
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto mobile-scroll">
              <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead className="text-right">ต้นทุน</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                      {product.sku}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
                        >
                          {product.name}
                        </Link>
                        {product.hasVariants && (
                          <Badge
                            variant="secondary"
                            className="bg-[var(--accent-light)] text-[var(--accent-primary)] text-xs"
                          >
                            <Layers className="w-3 h-3 mr-1" />
                            Variants
                          </Badge>
                        )}
                      </div>
                      {product.barcode && !product.hasVariants && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {product.barcode}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {product.itemType === 'RAW_MATERIAL' ? 'วัตถุดิบ'
                          : product.itemType === 'CONSUMABLE' ? 'วัสดุสิ้นเปลือง'
                          : 'สำเร็จรูป'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {product.category?.name || '-'}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {product.unit?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right text-[var(--text-secondary)]">
                      {Number(product.reorderPoint).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[var(--text-secondary)]">
                      ฿{Number(product.standardCost).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={
                          product.active
                            ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        }
                      >
                        {product.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ProductActions product={{ id: product.id, name: product.name, sku: product.sku }} />
                    </TableCell>
                  </TableRow>
                ))}
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
              <Link href={`/products?page=${page - 1}${search ? `&search=${search}` : ''}${categoryId ? `&category=${categoryId}` : ''}`}>
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
              <Link href={`/products?page=${page + 1}${search ? `&search=${search}` : ''}${categoryId ? `&category=${categoryId}` : ''}`}>
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

function ItemTypeTabs({ current, search, categoryId }: { current: string; search: string; categoryId: string }) {
  function buildHref(itemType: string) {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (categoryId) params.set('category', categoryId)
    if (itemType) params.set('itemType', itemType)
    const qs = params.toString()
    return `/products${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border p-1" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
      {ITEM_TYPE_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={buildHref(tab.value)}
          className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            current === tab.value
              ? 'bg-[var(--bg-primary)] text-[var(--brand)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

export default function ProductsPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={false} />}>
      <ProductsContent {...props} />
    </Suspense>
  )
}
