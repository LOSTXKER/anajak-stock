import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--bg-tertiary)]",
        className
      )}
      {...props}
    />
  )
}

// Table skeleton with realistic column widths
function TableSkeleton({ 
  rows = 5, 
  cols = 6,
  showHeader = true,
}: { 
  rows?: number
  cols?: number
  showHeader?: boolean
}) {
  // Varied widths for more realistic look
  const colWidths = ['w-16', 'w-full', 'w-24', 'w-20', 'w-20', 'w-16', 'w-12']
  
  return (
    <div className="w-full overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="flex gap-4 p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className={cn("h-4", colWidths[i % colWidths.length] || 'flex-1')} />
          ))}
        </div>
      )}
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div 
          key={rowIdx} 
          className="flex gap-4 p-4 border-b border-[var(--border-light)] last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className={cn("h-4", colWidths[colIdx % colWidths.length] || 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Card skeleton for stat cards
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  )
}

// Stat cards skeleton
function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Form skeleton with varied field sizes
function FormSkeleton({ fields = 4, hasTitle = true }: { fields?: number; hasTitle?: boolean }) {
  return (
    <div className="space-y-6">
      {hasTitle && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      )}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 space-y-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        {/* Submit buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Search bar skeleton
function SearchBarSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Skeleton className="h-10 flex-1 min-w-[250px] rounded-lg" />
        <Skeleton className="h-10 w-[180px] rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// Chart skeleton
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-10" />
          ))}
        </div>
        {/* Chart area */}
        <div className="ml-14 h-full flex items-end gap-2 pb-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="flex-1 rounded-t-lg" 
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-14 right-0 flex justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-8" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Pie chart skeleton
function PieChartSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex items-center justify-center py-4">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>
      {/* Legend */}
      <div className="space-y-2 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Detail page skeleton (for product detail, movement detail, etc.)
function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button + Title */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      
      {/* Main content card */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Table */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)]">
          <Skeleton className="h-5 w-32" />
        </div>
        <TableSkeleton rows={5} cols={5} showHeader={true} />
      </div>
    </div>
  )
}

// Page skeleton with header and content
function PageSkeleton({ 
  hasStats = true, 
  hasTable = true,
  hasSearch = true,
  statsCount = 4,
  tableRows = 8,
  tableCols = 6,
}: { 
  hasStats?: boolean
  hasTable?: boolean
  hasSearch?: boolean
  statsCount?: number
  tableRows?: number
  tableCols?: number
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
      
      {/* Stats */}
      {hasStats && <StatCardsSkeleton count={statsCount} />}
      
      {/* Search */}
      {hasSearch && <SearchBarSkeleton />}
      
      {/* Table */}
      {hasTable && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden">
          <TableSkeleton rows={tableRows} cols={tableCols} />
        </div>
      )}
    </div>
  )
}

// Dashboard skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Stats Grid */}
      <StatCardsSkeleton count={6} />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Movements */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton height={250} />
        </div>
        <PieChartSkeleton />
      </div>

      {/* Top Products Chart */}
      <ChartSkeleton height={300} />
    </div>
  )
}

// List item skeleton
function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-[var(--border-light)] last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  )
}

// Purchasing page skeleton (PR/PO/GRN tabs)
function PurchasingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      
      {/* Stats */}
      <StatCardsSkeleton count={4} />
      
      {/* Tabs */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <div className="flex gap-2 p-2 border-b border-[var(--border-default)]">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="p-0">
          <TableSkeleton rows={6} cols={6} />
        </div>
      </div>
    </div>
  )
}

export { 
  Skeleton, 
  TableSkeleton, 
  CardSkeleton, 
  StatCardsSkeleton, 
  FormSkeleton, 
  SearchBarSkeleton,
  ChartSkeleton,
  PieChartSkeleton,
  DetailPageSkeleton,
  PageSkeleton,
  DashboardSkeleton,
  PurchasingSkeleton,
  ListItemSkeleton,
}
