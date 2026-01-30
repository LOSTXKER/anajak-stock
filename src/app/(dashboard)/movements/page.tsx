import { Suspense } from 'react'
import Link from 'next/link'
import { getMovements } from '@/actions/movements'
import { getSession } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Settings2, ChevronLeft, ChevronRight } from 'lucide-react'
import { MovementType, DocStatus, Role } from '@/generated/prisma'
import { ExportButton } from '@/components/export-button'
import { PageHeader } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'
import { MovementDateFilter, MovementStatusFilter } from './movement-filters'
import { MovementsTable } from './movements-table'

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

async function MovementsContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const type = params.type
  const status = params.status
  const search = params.search
  const dateFrom = params.dateFrom
  const dateTo = params.dateTo

  // Get session for permission check
  const session = await getSession()
  const canApprove = session?.role === Role.ADMIN || session?.role === Role.APPROVER

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
          <div className="flex flex-wrap gap-2">
            <ExportButton
              endpoint="/api/export/movements"
              label="Export"
              className="hidden sm:inline-flex"
            />
            <Button variant="outline" size="sm" className="text-xs sm:text-sm text-[var(--status-success)] border-[var(--status-success)]/30 hover:bg-[var(--status-success-light)]" asChild>
              <Link href="/movements/new?type=RECEIVE">
                <ArrowDownToLine className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">รับเข้า</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm text-[var(--status-error)] border-[var(--status-error)]/30 hover:bg-[var(--status-error-light)]" asChild>
              <Link href="/movements/new?type=ISSUE">
                <ArrowUpFromLine className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">เบิกออก</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm text-[var(--status-info)] border-[var(--status-info)]/30 hover:bg-[var(--status-info-light)] hidden md:inline-flex" asChild>
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
        <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Type Filter */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <Button
              variant={!type ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href={status ? `/movements?status=${status}` : '/movements'}>ทุกประเภท</Link>
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
                  <Link href={status ? `/movements?type=${key}&status=${status}` : `/movements?type=${key}`}>
                    <config.icon className="w-4 h-4 mr-1" />
                    {config.label}
                  </Link>
                </Button>
              )
            })}
          </div>
          
          {/* Status Filter */}
          <div className="border-t border-[var(--border-default)] pt-3">
            <div className="text-xs text-[var(--text-muted)] mb-2">กรองตามสถานะ</div>
            <MovementStatusFilter />
          </div>
          
          {/* Date Range Filter */}
          <div className="border-t border-[var(--border-default)] pt-4">
            <MovementDateFilter />
          </div>
        </CardContent>
      </Card>

      {/* Movements Table with Selection */}
      <MovementsTable 
        movements={movements as unknown as Parameters<typeof MovementsTable>[0]['movements']} 
        canApprove={canApprove} 
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-16">
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
