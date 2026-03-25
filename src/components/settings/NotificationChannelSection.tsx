'use client'

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Globe, MessageSquare, Mail } from 'lucide-react'
import type {
  UserNotificationPreferences,
  NotificationChannels,
} from '@/actions/user-notification-preferences'
import { NotificationPreferenceItem } from './NotificationPreferenceItem'

export interface NotificationItem {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

export interface NotificationChannelSectionProps {
  title: string
  icon: React.ReactNode
  items: NotificationItem[]
  userPrefs: UserNotificationPreferences | null
  onUpdate: (key: string, channels: NotificationChannels) => void
}

export function NotificationChannelSection({
  title,
  icon,
  items,
  userPrefs,
  onUpdate,
}: NotificationChannelSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--bg-secondary)]">
              <TableHead className="w-[45%]">ประเภท</TableHead>
              <TableHead className="text-center w-[18%]">
                <div className="flex items-center justify-center gap-1">
                  <Globe className="w-4 h-4 text-[var(--status-success)]" />
                  <span className="hidden sm:inline">เว็บ</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-[18%]">
                <div className="flex items-center justify-center gap-1">
                  <MessageSquare className="w-4 h-4 text-[#00B900]" />
                  <span className="hidden sm:inline">LINE</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-[18%]">
                <div className="flex items-center justify-center gap-1">
                  <Mail className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span className="hidden sm:inline">Email</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const channels = userPrefs?.[item.key as keyof UserNotificationPreferences] as NotificationChannels | undefined
              return (
                <NotificationPreferenceItem
                  key={item.key}
                  itemKey={item.key}
                  label={item.label}
                  description={item.description}
                  icon={item.icon}
                  color={item.color}
                  channels={channels}
                  onUpdate={onUpdate}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
