import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-[var(--border-default)] via-[var(--bg-hover)] to-[var(--border-default)] bg-[length:200%_100%]",
        className
      )}
      style={{
        animation: 'shimmer 1.5s infinite ease-in-out',
      }}
      {...props}
    />
  )
}

// Table skeleton
function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-[var(--border-default)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-b border-[var(--border-subtle)]">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Card skeleton
function CardSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
      <Skeleton className="h-4 w-24 mb-4" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// Stat cards skeleton
function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-${Math.min(count, 4)} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Form skeleton
function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

// Page skeleton with header and content
function PageSkeleton({ hasStats = true, hasTable = true }: { hasStats?: boolean; hasTable?: boolean }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Stats */}
      {hasStats && <StatCardsSkeleton count={4} />}
      
      {/* Table */}
      {hasTable && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]">
          <TableSkeleton rows={8} cols={6} />
        </div>
      )}
    </div>
  )
}

// List item skeleton
function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-[var(--border-subtle)]">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  )
}

export { 
  Skeleton, 
  TableSkeleton, 
  CardSkeleton, 
  StatCardsSkeleton, 
  FormSkeleton, 
  PageSkeleton,
  ListItemSkeleton,
}
