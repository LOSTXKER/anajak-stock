import { Suspense } from 'react'
import Link from 'next/link'
import { getPOs } from '@/actions/po'
import { Card, CardContent } from '@/components/ui/card'
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
import { ShoppingCart, Plus, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { POStatus } from '@/generated/prisma'
import { formatDate } from '@/lib/date'
import { PageHeader, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise<{
    page?: string
    status?: POStatus
    search?: string
  }>
}

const statusConfig: Record<POStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  SUBMITTED: { label: 'รออนุมัติ', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  APPROVED: { label: 'อนุมัติแล้ว', color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]' },
  REJECTED: { label: 'ไม่อนุมัติ', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
  SENT: { label: 'ส่งแล้ว', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  PARTIALLY_RECEIVED: { label: 'รับบางส่วน', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  FULLY_RECEIVED: { label: 'รับครบ', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  CLOSED: { label: 'ปิดแล้ว', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
}

async function POContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const status = params.status
  const search = params.search

  const { items: pos, total, totalPages } = await getPOs({
    page,
    limit: 20,
    status,
    search,
  })

  const buildUrl = (newPage: number) => {
    const p = new URLSearchParams()
    p.set('page', newPage.toString())
    if (status) p.set('status', status)
    if (search) p.set('search', search)
    return `/po?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="ใบสั่งซื้อ (PO)"
        description={`Purchase Order ทั้งหมด ${total.toLocaleString()} รายการ`}
        icon={<ShoppingCart className="w-6 h-6" />}
        actions={
          <Button asChild>
            <Link href="/po/new">
              <Plus className="w-4 h-4 mr-2" />
              สร้าง PO
            </Link>
          </Button>
        }
      />

      {/* Quick Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!status ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href="/po">ทั้งหมด</Link>
            </Button>
            {Object.entries(statusConfig).slice(0, 6).map(([key, config]) => (
              <Button
                key={key}
                variant={status === key ? 'default' : 'outline'}
                size="sm"
                asChild
              >
                <Link href={`/po?status=${key}`}>{config.label}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PO Table */}
      <Card>
        <CardContent className="p-0">
          {pos.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="w-12 h-12" />}
              title="ไม่พบใบสั่งซื้อ"
              description="ลองเปลี่ยนตัวกรอง หรือสร้างใบสั่งซื้อใหม่"
              action={
                <Button asChild>
                  <Link href="/po/new">
                    <Plus className="w-4 h-4 mr-2" />
                    สร้าง PO
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ PO</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ซัพพลายเออร์</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead>กำหนดส่ง</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => {
                  const statusInfo = statusConfig[po.status]

                  return (
                    <TableRow key={po.id}>
                      <TableCell>
                        <Link
                          href={`/po/${po.id}`}
                          className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                        >
                          {po.poNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {po.supplier.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {po.lines.length} รายการ
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--text-primary)]">
                        ฿{Number(po.total || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {formatDate(po.eta)}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {formatDate(po.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/po/${po.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
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

export default function POPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={false} />}>
      <POContent {...props} />
    </Suspense>
  )
}
