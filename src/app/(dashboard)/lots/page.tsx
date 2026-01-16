import { Suspense } from 'react'
import Link from 'next/link'
import { getLots } from '@/actions/lots'
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
import { Package, Search, ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'
import { LotSearch } from './lot-search'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
  }>
}

function getStatusBadge(lot: { expiryDate: Date | null; totalQtyOnHand: number }) {
  if (lot.totalQtyOnHand <= 0) {
    return (
      <Badge variant="secondary" className="bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        หมดสต๊อค
      </Badge>
    )
  }
  
  if (!lot.expiryDate) {
    return (
      <Badge variant="secondary" className="bg-[var(--status-success-light)] text-[var(--status-success)]">
        <CheckCircle className="w-3 h-3 mr-1" />
        ปกติ
      </Badge>
    )
  }
  
  const now = new Date()
  const daysUntilExpiry = Math.ceil((lot.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntilExpiry < 0) {
    return (
      <Badge variant="secondary" className="bg-[var(--status-error-light)] text-[var(--status-error)]">
        <AlertTriangle className="w-3 h-3 mr-1" />
        หมดอายุ
      </Badge>
    )
  }
  
  if (daysUntilExpiry <= 30) {
    return (
      <Badge variant="secondary" className="bg-[var(--status-warning-light)] text-[var(--status-warning)]">
        <Clock className="w-3 h-3 mr-1" />
        ใกล้หมดอายุ ({daysUntilExpiry} วัน)
      </Badge>
    )
  }
  
  return (
    <Badge variant="secondary" className="bg-[var(--status-success-light)] text-[var(--status-success)]">
      <CheckCircle className="w-3 h-3 mr-1" />
      ปกติ
    </Badge>
  )
}

async function LotsContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const status = (params.status as 'all' | 'in_stock' | 'expired' | 'expiring_soon') || 'all'

  const result = await getLots({ 
    page, 
    limit: 20, 
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
  })

  if (!result.success) {
    return <div className="text-[var(--status-error)]">{result.error}</div>
  }

  const lots = result.data
  const total = 'total' in result ? result.total : 0
  const totalPages = 'totalPages' in result ? result.totalPages : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Lot / Batch"
        description={`จัดการ Lot สินค้าทั้งหมด ${total.toLocaleString()} รายการ`}
        icon={<Package className="w-6 h-6" />}
      />

      {/* Search & Filter */}
      <LotSearch />

      {/* Lots Table */}
      <Card>
        <CardContent className="p-0">
          {lots.length === 0 ? (
            <EmptyState
              icon={<Search className="w-12 h-12" />}
              title="ไม่พบ Lot"
              description="ลองเปลี่ยนเงื่อนไขการค้นหา หรือ Lot จะถูกสร้างอัตโนมัติเมื่อรับสินค้าเข้า"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>หมายเลข Lot</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">รับเข้า</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead>วันหมดอายุ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>
                      <Link 
                        href={`/lots/${lot.id}`}
                        className="font-mono text-[var(--accent-primary)] hover:underline"
                      >
                        {lot.lotNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Link 
                          href={`/products/${lot.product.id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                        >
                          {lot.product.name}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">{lot.product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {lot.variant ? (
                        <span className="text-sm">{lot.variant.name || lot.variant.sku}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[var(--text-secondary)]">
                      {lot.qtyReceived.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-semibold ${
                        lot.totalQtyOnHand <= 0 
                          ? 'text-[var(--text-muted)]' 
                          : 'text-[var(--text-primary)]'
                      }`}>
                        {lot.totalQtyOnHand.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {lot.expiryDate 
                        ? format(new Date(lot.expiryDate), 'd MMM yyyy', { locale: th })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {getStatusBadge({ 
                        expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : null, 
                        totalQtyOnHand: lot.totalQtyOnHand 
                      })}
                    </TableCell>
                    <TableCell>
                      {lot.balances.length > 0 ? (
                        <div className="space-y-1">
                          {lot.balances.slice(0, 2).map((b, i) => (
                            <div key={i} className="text-xs text-[var(--text-secondary)]">
                              {b.location.warehouse?.name} - {b.location.code}: {b.qtyOnHand.toLocaleString()}
                            </div>
                          ))}
                          {lot.balances.length > 2 && (
                            <div className="text-xs text-[var(--text-muted)]">
                              +{lot.balances.length - 2} locations
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
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
              <Link href={`/lots?page=${page - 1}${search ? `&search=${search}` : ''}${status !== 'all' ? `&status=${status}` : ''}`}>
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
              <Link href={`/lots?page=${page + 1}${search ? `&search=${search}` : ''}${status !== 'all' ? `&status=${status}` : ''}`}>
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

export default function LotsPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={false} />}>
      <LotsContent {...props} />
    </Suspense>
  )
}
