/**
 * LoadingState - Loading indicators and skeletons
 */

import { Loader2 } from 'lucide-react'

// Spinner loader
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const spinnerSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <Loader2
      className={`animate-spin text-[var(--accent-primary)] ${spinnerSizes[size]} ${className}`}
    />
  )
}

// Full page loading
export function PageLoading({ message = 'กำลังโหลด...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
      <p className="mt-4 text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

// Inline loading
export function InlineLoading({ message = 'กำลังโหลด...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-[var(--text-muted)]">
      <Spinner size="sm" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

// Skeleton components
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--bg-tertiary)] rounded ${className}`}
    />
  )
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`p-6 border border-[var(--border-default)] rounded-lg ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-4 border-b border-[var(--border-default)] last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
