'use client'

import { Switch } from '@/components/ui/switch'
import { TableCell, TableRow } from '@/components/ui/table'
import type { NotificationChannels } from '@/actions/user-notification-preferences'

export interface NotificationPreferenceItemProps {
  itemKey: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  channels: NotificationChannels | undefined
  onUpdate: (key: string, channels: NotificationChannels) => void
}

export function NotificationPreferenceItem({
  itemKey,
  label,
  description,
  icon: Icon,
  color,
  channels,
  onUpdate,
}: NotificationPreferenceItemProps) {
  const webEnabled = channels?.web ?? true
  const lineEnabled = channels?.line ?? true
  const emailEnabled = channels?.email ?? true

  return (
    <TableRow className="hover:bg-[var(--bg-secondary)]/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${color} shrink-0`} />
          <div className="min-w-0">
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{description}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center">
          <Switch
            checked={webEnabled}
            onCheckedChange={(checked) => onUpdate(itemKey, {
              web: checked,
              line: lineEnabled,
              email: emailEnabled,
            })}
            className="data-[state=checked]:bg-[var(--status-success)]"
          />
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center">
          <Switch
            checked={lineEnabled}
            onCheckedChange={(checked) => onUpdate(itemKey, {
              web: webEnabled,
              line: checked,
              email: emailEnabled,
            })}
            className="data-[state=checked]:bg-[#00B900]"
          />
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center">
          <Switch
            checked={emailEnabled}
            onCheckedChange={(checked) => onUpdate(itemKey, {
              web: webEnabled,
              line: lineEnabled,
              email: checked,
            })}
            className="data-[state=checked]:bg-[var(--accent-primary)]"
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
