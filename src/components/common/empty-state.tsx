/**
 * EmptyState - Display when no data is available
 * 
 * @example
 * <EmptyState
 *   icon={<Package className="w-12 h-12" />}
 *   title="ไม่พบสินค้า"
 *   description="ยังไม่มีสินค้าในระบบ"
 *   action={<Button>เพิ่มสินค้า</Button>}
 * />
 */

import { Search, FileX } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <div className="p-4 rounded-full bg-[var(--bg-tertiary)] mb-4 text-[var(--text-muted)]">
        {icon || <FileX className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// Specific variants
export function NoSearchResults({
  query,
  className,
}: {
  query?: string
  className?: string
}) {
  return (
    <EmptyState
      icon={<Search className="w-8 h-8" />}
      title="ไม่พบข้อมูล"
      description={
        query ? `ไม่พบผลลัพธ์สำหรับ "${query}"` : 'ไม่พบข้อมูลที่ตรงกับการค้นหา'
      }
      className={className}
    />
  )
}

export function NoData({
  message = 'ยังไม่มีข้อมูล',
  action,
  className,
}: {
  message?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <EmptyState
      icon={<FileX className="w-8 h-8" />}
      title={message}
      action={action}
      className={className}
    />
  )
}
