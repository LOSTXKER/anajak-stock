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
import { Package, Plus, Search, Layers, FileUp, ChevronLeft, ChevronRight } from 'lucide-react'
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
  }>
}

async function ProductsContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const categoryId = params.category || ''

  const [{ items: products, total, totalPages }, categories] = await Promise.all([
    getProducts({ page, limit: 20, search, categoryId: categoryId || undefined }),
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
          <div className="flex gap-2">
            <ExportButton
              endpoint="/api/export/products"
              label="Export"
            />
            <Button variant="outline" asChild>
              <Link href="/products/import">
                <FileUp className="w-4 h-4 mr-2" />
                นำเข้า CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มสินค้า
              </Link>
            </Button>
          </div>
        }
      />

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
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

export default function ProductsPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={false} />}>
      <ProductsContent {...props} />
    </Suspense>
  )
}
