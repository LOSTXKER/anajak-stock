import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface LinkPaginationProps {
  page: number
  totalPages: number
  buildUrl: (page: number) => string
  className?: string
}

export function LinkPagination({
  page,
  totalPages,
  buildUrl,
  className = '',
}: LinkPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        asChild={page > 1}
        aria-label="หน้าก่อนหน้า"
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
        aria-label="หน้าถัดไป"
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
  )
}
