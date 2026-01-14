'use client'

import { HelpCircle, Info, Lightbulb } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  variant?: 'help' | 'info' | 'tip'
  className?: string
  iconClassName?: string
}

export function HelpTooltip({
  content,
  side = 'top',
  variant = 'help',
  className,
  iconClassName,
}: HelpTooltipProps) {
  const Icon = variant === 'help' ? HelpCircle : variant === 'info' ? Info : Lightbulb

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full p-0.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-1",
              className
            )}
          >
            <Icon className={cn("w-4 h-4", iconClassName)} />
            <span className="sr-only">ดูคำอธิบาย</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Inline help text with icon
interface InlineHelpProps {
  children: React.ReactNode
  tooltip: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function InlineHelp({ children, tooltip, side = 'top' }: InlineHelpProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <HelpTooltip content={tooltip} side={side} />
    </span>
  )
}

// Feature highlight badge
interface FeatureBadgeProps {
  label: string
  description: string
  variant?: 'new' | 'beta' | 'pro'
}

export function FeatureBadge({ label, description, variant = 'new' }: FeatureBadgeProps) {
  const colors = {
    new: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    beta: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    pro: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium cursor-help",
            colors[variant]
          )}>
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
