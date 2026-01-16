import { Skeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Chart */}
      <ChartSkeleton height={350} />

      {/* Table */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  )
}
