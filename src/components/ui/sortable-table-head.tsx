'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { TableHead } from './table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableTableHeadProps {
  column: string
  label: string
  currentSort?: string
  currentOrder?: 'asc' | 'desc'
  className?: string
}

export function SortableTableHead({
  column,
  label,
  currentSort,
  currentOrder,
  className,
}: SortableTableHeadProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = currentSort === column
  const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc'

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sortBy', column)
    params.set('sortOrder', nextOrder)
    params.set('page', '1') // Reset to first page when sorting
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:bg-[var(--bg-tertiary)] transition-colors',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          currentOrder === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-[var(--accent-primary)]" />
          ) : (
            <ArrowDown className="w-4 h-4 text-[var(--accent-primary)]" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </div>
    </TableHead>
  )
}
