import { Suspense } from 'react'
import Link from 'next/link'
import { getPRs } from '@/actions/pr'
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
import { FileText, Plus, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { PRStatus } from '@/generated/prisma'
import { formatDate, formatDateTime } from '@/lib/date'
import { PageHeader, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise<{
    page?: string
    status?: PRStatus
    search?: string
  }>
}

const statusConfig: Record<PRStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  SUBMITTED: { label: 'รออนุมัติ', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  APPROVED: { label: 'อนุมัติแล้ว', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  REJECTED: { label: 'ปฏิเสธ', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
  CONVERTED: { label: 'แปลงเป็น PO', color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
}

async function PRContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const status = params.status
  const search = params.search

  const { items: prs, total, totalPages } = await getPRs({
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
    return `/pr?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="ใบขอซื้อ (PR)"
        description={`Purchase Requisition ทั้งหมด ${total.toLocaleString()} รายการ`}
        icon={<FileText className="w-6 h-6" />}
        actions={
          <Button asChild>
            <Link href="/pr/new">
              <Plus className="w-4 h-4 mr-2" />
              สร้าง PR
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
              <Link href="/pr">ทั้งหมด</Link>
            </Button>
            {Object.entries(statusConfig).map(([key, config]) => (
              <Button
                key={key}
                variant={status === key ? 'default' : 'outline'}
                size="sm"
                asChild
              >
                <Link href={`/pr?status=${key}`}>{config.label}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PR Table */}
      <Card>
        <CardContent className="p-0">
          {prs.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="ไม่พบใบขอซื้อ"
              description="ลองเปลี่ยนตัวกรอง หรือสร้างใบขอซื้อใหม่"
              action={
                <Button asChild>
                  <Link href="/pr/new">
                    <Plus className="w-4 h-4 mr-2" />
                    สร้าง PR
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ PR</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ผู้ขอ</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>ต้องการภายใน</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prs.map((pr) => {
                  const statusInfo = statusConfig[pr.status]

                  return (
                    <TableRow key={pr.id}>
                      <TableCell>
                        <Link
                          href={`/pr/${pr.id}`}
                          className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                        >
                          {pr.prNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {pr.requester.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {pr.lines.length} รายการ
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {formatDate(pr.needByDate)}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {formatDateTime(pr.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/pr/${pr.id}`}>
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

export default function PRPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={false} />}>
      <PRContent {...props} />
    </Suspense>
  )
}
