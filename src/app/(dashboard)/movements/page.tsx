import { Suspense } from 'react'
import Link from 'next/link'
import { getMovements } from '@/actions/movements'
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
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Settings2, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { MovementType, DocStatus } from '@/generated/prisma'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { ExportButton } from '@/components/export-button'
import { PageHeader, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'
import { MovementDateFilter } from './movement-filters'

interface PageProps {
  searchParams: Promise<{
    page?: string
    type?: MovementType
    status?: DocStatus
    search?: string
    dateFrom?: string
    dateTo?: string
  }>
}

const typeConfig: Record<MovementType, { label: string; icon: React.ElementType; color: string; activeColor: string }> = {
  RECEIVE: { 
    label: 'รับเข้า', 
    icon: ArrowDownToLine, 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    activeColor: 'bg-[var(--status-success)] text-white hover:bg-[var(--status-success-dark)]'
  },
  ISSUE: { 
    label: 'เบิกออก', 
    icon: ArrowUpFromLine, 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    activeColor: 'bg-[var(--status-error)] text-white hover:bg-[var(--status-error-dark)]'
  },
  TRANSFER: { 
    label: 'โอนย้าย', 
    icon: RefreshCw, 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
    activeColor: 'bg-[var(--status-info)] text-white hover:bg-[var(--status-info-dark)]'
  },
  ADJUST: { 
    label: 'ปรับยอด', 
    icon: Settings2, 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    activeColor: 'bg-[var(--status-warning)] text-white hover:bg-[var(--status-warning-dark)]'
  },
  RETURN: { 
    label: 'คืนของ', 
    icon: ArrowLeftRight, 
    color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
    activeColor: 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'
  },
}

const statusConfig: Record<DocStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  SUBMITTED: { label: 'รอดำเนินการ', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  APPROVED: { label: 'อนุมัติแล้ว', color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]' },
  REJECTED: { label: 'ปฏิเสธ', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
  POSTED: { label: 'บันทึกแล้ว', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  CLOSED: { label: 'ปิดแล้ว', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
}

async function MovementsContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const type = params.type
  const status = params.status
  const search = params.search
  const dateFrom = params.dateFrom
  const dateTo = params.dateTo

  const { items: movements, total, totalPages } = await getMovements({
    page,
    limit: 20,
    type,
    status,
    search,
    dateFrom,
    dateTo,
  })

  const buildUrl = (newPage: number) => {
    const p = new URLSearchParams()
    p.set('page', newPage.toString())
    if (type) p.set('type', type)
    if (status) p.set('status', status)
    if (search) p.set('search', search)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    return `/movements?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="เคลื่อนไหวสต๊อค"
        description={`รายการเคลื่อนไหวสินค้าทั้งหมด ${total.toLocaleString()} รายการ`}
        icon={<ArrowLeftRight className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <ExportButton
              endpoint="/api/export/movements"
              label="Export"
            />
            <Button variant="outline" className="text-[var(--status-success)] border-[var(--status-success)]/30 hover:bg-[var(--status-success-light)]" asChild>
              <Link href="/movements/new?type=RECEIVE">
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                รับเข้า
              </Link>
            </Button>
            <Button variant="outline" className="text-[var(--status-error)] border-[var(--status-error)]/30 hover:bg-[var(--status-error-light)]" asChild>
              <Link href="/movements/new?type=ISSUE">
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                เบิกออก
              </Link>
            </Button>
            <Button variant="outline" className="text-[var(--status-info)] border-[var(--status-info)]/30 hover:bg-[var(--status-info-light)]" asChild>
              <Link href="/movements/new?type=TRANSFER">
                <RefreshCw className="w-4 h-4 mr-2" />
                โอนย้าย
              </Link>
            </Button>
          </div>
        }
      />

      {/* Quick Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!type && !status ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href="/movements">ทั้งหมด</Link>
            </Button>
            {Object.entries(typeConfig).map(([key, config]) => {
              const isActive = type === key
              return (
                <Button
                  key={key}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className={isActive ? config.activeColor : ''}
                  asChild
                >
                  <Link href={`/movements?type=${key}`}>
                    <config.icon className="w-4 h-4 mr-1" />
                    {config.label}
                  </Link>
                </Button>
              )
            })}
          </div>
          
          {/* Date Range Filter */}
          <div className="border-t border-[var(--border-default)] pt-4">
            <MovementDateFilter />
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="w-12 h-12" />}
              title="ไม่พบรายการเคลื่อนไหว"
              description="ลองเปลี่ยนตัวกรอง หรือสร้างรายการเคลื่อนไหวใหม่"
              action={
                <Button asChild>
                  <Link href="/movements/new?type=RECEIVE">
                    <ArrowDownToLine className="w-4 h-4 mr-2" />
                    รับเข้าสินค้า
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่เอกสาร</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>ผู้สร้าง</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  const typeInfo = typeConfig[movement.type]
                  const statusInfo = statusConfig[movement.status]
                  const TypeIcon = typeInfo.icon

                  return (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <Link
                          href={`/movements/${movement.id}`}
                          className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                        >
                          {movement.docNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={typeInfo.color}>
                          <TypeIcon className="w-3 h-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {movement.lines.length} รายการ
                        {movement.lines[0] && (
                          <span className="text-[var(--text-muted)] text-xs ml-2">
                            ({movement.lines[0].product.name}
                            {movement.lines[0].variant && (
                              <span className="text-[var(--accent-primary)]">
                                {' - '}{movement.lines[0].variant.name || movement.lines[0].variant.sku}
                              </span>
                            )}
                            {movement.lines.length > 1 && ` +${movement.lines.length - 1}`})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {movement.createdBy.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {format(new Date(movement.createdAt), 'd MMM yy HH:mm', { locale: th })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/movements/${movement.id}`}>
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

export default function MovementsPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton hasStats={false} />}>
      <MovementsContent {...props} />
    </Suspense>
  )
}
