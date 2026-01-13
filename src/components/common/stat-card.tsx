'use client'

/**
 * StatCard - Dashboard statistic card component
 * 
 * @example
 * <StatCard
 *   title="จำนวนสินค้า"
 *   value={1234}
 *   icon={Package}
 *   variant="primary"
 * />
 */

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import React from 'react'

type StatCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode | LucideIcon
  subtitle?: string
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: StatCardVariant
  href?: string
  className?: string
}

const variantStyles: Record<StatCardVariant, { bg: string; icon: string }> = {
  default: {
    bg: 'bg-[var(--bg-tertiary)]',
    icon: 'text-[var(--text-secondary)]',
  },
  primary: {
    bg: 'bg-[var(--accent-light)]',
    icon: 'text-[var(--accent-primary)]',
  },
  success: {
    bg: 'bg-[var(--status-success-light)]',
    icon: 'text-[var(--status-success)]',
  },
  warning: {
    bg: 'bg-[var(--status-warning-light)]',
    icon: 'text-[var(--status-warning)]',
  },
  error: {
    bg: 'bg-[var(--status-error-light)]',
    icon: 'text-[var(--status-error)]',
  },
  info: {
    bg: 'bg-[var(--status-info-light)]',
    icon: 'text-[var(--status-info)]',
  },
}

// Helper to check if icon is a LucideIcon component reference
function isLucideIcon(icon: React.ReactNode | LucideIcon): icon is LucideIcon {
  // Check for function components
  if (typeof icon === 'function') return true
  // Check for forwardRef components (have $$typeof and render properties)
  if (
    icon &&
    typeof icon === 'object' &&
    '$$typeof' in icon &&
    'render' in icon &&
    typeof (icon as { render: unknown }).render === 'function'
  ) {
    return true
  }
  return false
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  description,
  trend,
  variant = 'default',
  href,
  className = '',
}: StatCardProps) {
  const styles = variantStyles[variant]

  const formattedValue =
    typeof value === 'number' ? value.toLocaleString() : value

  // Render icon - supports both LucideIcon references and React elements
  const renderIcon = () => {
    if (!icon) return null
    if (isLucideIcon(icon)) {
      // Cast to any to handle both function and forwardRef components
      const Icon = icon as React.ComponentType<{ className?: string }>
      return <Icon className="w-6 h-6" />
    }
    return icon
  }

  const content = (
    <Card className={`border-[var(--border-default)] transition-shadow hover:shadow-md ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-[var(--text-muted)]">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {formattedValue}
            </p>
            {(subtitle || description) && (
              <p className="text-xs text-[var(--text-muted)]">{subtitle || description}</p>
            )}
            {trend && (
              <p
                className={`text-sm font-medium ${
                  trend.isPositive
                    ? 'text-[var(--status-success)]'
                    : 'text-[var(--status-error)]'
                }`}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </p>
            )}
          </div>
          {icon && (
            <div className={`p-3 rounded-xl ${styles.bg} ${styles.icon}`}>
              {renderIcon()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

// Grid wrapper for multiple stat cards
interface StatCardGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function StatCardGrid({
  children,
  columns = 3,
  className = '',
}: StatCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>
      {children}
    </div>
  )
}
