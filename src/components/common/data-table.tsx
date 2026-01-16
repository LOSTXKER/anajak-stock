/**
 * DataTable - Generic data table with pagination
 * 
 * @example
 * <DataTable
 *   data={products}
 *   columns={[
 *     { key: 'sku', header: 'SKU' },
 *     { key: 'name', header: 'ชื่อ', render: (row) => <Link>{row.name}</Link> },
 *   ]}
 *   pagination={{ page: 1, totalPages: 10, total: 100 }}
 * />
 */

'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { startNavigation } from '@/components/navigation-progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react'
import { NoSearchResults, NoData } from './empty-state'
import { SkeletonTable } from './loading-state'
import { cn } from '@/lib/utils'

// Column definition
interface Column<T> {
  key: string
  header: string
  className?: string
  headerClassName?: string
  render?: (row: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

// Pagination info
interface PaginationInfo {
  page: number
  totalPages: number
  total: number
  limit?: number
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pagination?: PaginationInfo
  isLoading?: boolean
  emptyMessage?: string
  emptyAction?: React.ReactNode
  onRowClick?: (row: T) => void
  className?: string
  stickyHeader?: boolean
  loadingRows?: number
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pagination,
  isLoading = false,
  emptyMessage = 'ไม่พบข้อมูล',
  emptyAction,
  onRowClick,
  className = '',
  stickyHeader = false,
  loadingRows = 8,
}: DataTableProps<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const goToPage = (page: number) => {
    startNavigation()
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(page))
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  // Show skeleton when initially loading
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
          <SkeletonTable rows={loadingRows} cols={columns.length} />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    const hasSearch = searchParams.get('search')
    if (hasSearch) {
      return <NoSearchResults query={hasSearch} />
    }
    return <NoData message={emptyMessage} action={emptyAction} />
  }

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div 
        className={cn(
          "border border-[var(--border-default)] rounded-lg overflow-hidden transition-opacity duration-200",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        <Table>
          <TableHeader className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <TableRow className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`text-[var(--text-secondary)] font-medium ${
                    alignClass[col.align || 'left']
                  } ${col.headerClassName || ''}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={`border-[var(--border-default)] transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-[var(--bg-secondary)]' : ''
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={`${alignClass[col.align || 'left']} ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(row, rowIndex)
                      : String(row[col.key] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={goToPage}
          isLoading={isPending}
        />
      )}
    </div>
  )
}

// Pagination component
interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit?: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function Pagination({
  page,
  totalPages,
  total,
  limit = 20,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2">
        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
        )}
        <p className={cn(
          "text-sm text-[var(--text-muted)] transition-opacity",
          isLoading && "opacity-50"
        )}>
          แสดง {start}-{end} จาก {total.toLocaleString()} รายการ
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={page === 1 || isLoading}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1 || isLoading}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className={cn(
          "px-3 text-sm text-[var(--text-secondary)] min-w-[100px] text-center transition-opacity",
          isLoading && "opacity-50"
        )}>
          หน้า {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || isLoading}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages || isLoading}
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
