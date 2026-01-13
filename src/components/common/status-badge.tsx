/**
 * StatusBadge - Document and entity status indicators
 * 
 * @example
 * <StatusBadge status="approved" />
 * <StatusBadge status="pending" label="รออนุมัติ" />
 */

import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  type LucideIcon,
} from 'lucide-react'

// Status types
type StatusType =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'partial'
  | 'active'
  | 'inactive'

interface StatusConfig {
  label: string
  bgColor: string
  textColor: string
  icon: LucideIcon
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  draft: {
    label: 'ร่าง',
    bgColor: 'bg-[var(--bg-tertiary)]',
    textColor: 'text-[var(--text-muted)]',
    icon: FileText,
  },
  pending: {
    label: 'รออนุมัติ',
    bgColor: 'bg-[var(--status-warning-light)]',
    textColor: 'text-[var(--status-warning)]',
    icon: Clock,
  },
  approved: {
    label: 'อนุมัติ',
    bgColor: 'bg-[var(--status-success-light)]',
    textColor: 'text-[var(--status-success)]',
    icon: CheckCircle,
  },
  rejected: {
    label: 'ไม่อนุมัติ',
    bgColor: 'bg-[var(--status-error-light)]',
    textColor: 'text-[var(--status-error)]',
    icon: XCircle,
  },
  cancelled: {
    label: 'ยกเลิก',
    bgColor: 'bg-[var(--bg-tertiary)]',
    textColor: 'text-[var(--text-muted)]',
    icon: XCircle,
  },
  completed: {
    label: 'เสร็จสิ้น',
    bgColor: 'bg-[var(--status-success-light)]',
    textColor: 'text-[var(--status-success)]',
    icon: CheckCircle,
  },
  partial: {
    label: 'บางส่วน',
    bgColor: 'bg-[var(--status-info-light)]',
    textColor: 'text-[var(--status-info)]',
    icon: AlertCircle,
  },
  active: {
    label: 'ใช้งาน',
    bgColor: 'bg-[var(--status-success-light)]',
    textColor: 'text-[var(--status-success)]',
    icon: CheckCircle,
  },
  inactive: {
    label: 'ไม่ใช้งาน',
    bgColor: 'bg-[var(--bg-tertiary)]',
    textColor: 'text-[var(--text-muted)]',
    icon: XCircle,
  },
}

interface StatusBadgeProps {
  status: StatusType | string
  label?: string
  showIcon?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({
  status,
  label,
  showIcon = false,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  const config = statusConfigs[status.toLowerCase() as StatusType] || {
    label: status,
    bgColor: 'bg-[var(--bg-tertiary)]',
    textColor: 'text-[var(--text-muted)]',
    icon: AlertCircle,
  }

  const Icon = config.icon
  const displayLabel = label || config.label

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses} ${className}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      {displayLabel}
    </span>
  )
}

// Mapping functions for specific status enums
export function mapDocStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    DRAFT: 'draft',
    POSTED: 'completed',
    CANCELLED: 'cancelled',
  }
  return mapping[status] || 'draft'
}

export function mapPRStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    DRAFT: 'draft',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CONVERTED: 'completed',
    CANCELLED: 'cancelled',
  }
  return mapping[status] || 'draft'
}

export function mapPOStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    DRAFT: 'draft',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ORDERED: 'active',
    PARTIAL: 'partial',
    RECEIVED: 'completed',
    CANCELLED: 'cancelled',
  }
  return mapping[status] || 'draft'
}
