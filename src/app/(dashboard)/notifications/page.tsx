'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bell,
  Check,
  Trash2,
  Loader2,
  ExternalLink,
  Filter,
  RefreshCw,
  Inbox,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  cleanupOldNotifications,
} from '@/actions/notifications'
import {
  getNotificationIcon,
  getNotificationColor,
  type AppNotification,
  type NotificationType,
} from '@/lib/notifications'
import { formatDistanceToNow, format } from 'date-fns'
import { th } from 'date-fns/locale'

type FilterStatus = 'all' | 'unread' | 'read'
type FilterType = 'all' | NotificationType

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')

  const loadNotifications = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true)
    try {
      const result = await getNotifications()
      if (result.success && result.data) {
        setNotifications(result.data)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast.error('ไม่สามารถโหลดการแจ้งเตือนได้')
    } finally {
      setIsLoading(false)
      if (showRefreshState) setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  async function handleMarkAsRead(id: string) {
    const result = await markNotificationAsRead(id)
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    }
  }

  async function handleMarkAllAsRead() {
    const result = await markAllNotificationsAsRead()
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success('อ่านทั้งหมดแล้ว')
    }
  }

  async function handleCleanup() {
    setIsCleaning(true)
    const result = await cleanupOldNotifications(30)
    setIsCleaning(false)
    
    if (result.success && result.data) {
      toast.success(`ลบการแจ้งเตือนเก่า ${result.data.count} รายการ`)
      loadNotifications()
    } else if (!result.success) {
      toast.error(result.error || 'ไม่สามารถลบได้')
    }
  }

  async function handleRefresh() {
    await loadNotifications(true)
    toast.success('รีเฟรชแล้ว')
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (filterStatus === 'unread' && n.read) return false
    if (filterStatus === 'read' && !n.read) return false
    if (filterType !== 'all' && n.type !== filterType) return false
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  // Group by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = format(new Date(notification.createdAt), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(notification)
    return groups
  }, {} as Record<string, AppNotification[]>)

  const sortedDates = Object.keys(groupedNotifications).sort((a, b) => b.localeCompare(a))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="การแจ้งเตือนทั้งหมด"
        description={`${notifications.length} รายการ${unreadCount > 0 ? ` (${unreadCount} ยังไม่อ่าน)` : ''}`}
        icon={<Bell className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                <Check className="w-4 h-4 mr-2" />
                อ่านทั้งหมด
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-muted)]">กรอง:</span>
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="unread">ยังไม่อ่าน</SelectItem>
                <SelectItem value="read">อ่านแล้ว</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="low_stock">สต๊อคใกล้หมด</SelectItem>
                <SelectItem value="pr_pending">PR รออนุมัติ</SelectItem>
                <SelectItem value="po_pending">PO รออนุมัติ</SelectItem>
                <SelectItem value="po_overdue">PO เกินกำหนด</SelectItem>
                <SelectItem value="grn_received">รับสินค้า</SelectItem>
                <SelectItem value="expiring_soon">ใกล้หมดอายุ</SelectItem>
                <SelectItem value="system">ระบบ</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanup}
              disabled={isCleaning}
              className="text-[var(--text-muted)]"
            >
              {isCleaning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              ลบเก่า 30 วัน
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
              <Inbox className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">ไม่มีการแจ้งเตือน</p>
              <p className="text-sm">
                {filterStatus !== 'all' || filterType !== 'all'
                  ? 'ลองเปลี่ยนตัวกรองดู'
                  : 'เมื่อมีการแจ้งเตือนใหม่ จะแสดงที่นี่'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3 px-1">
                {format(new Date(date), 'd MMMM yyyy', { locale: th })}
              </h3>
              <Card>
                <CardContent className="p-0 divide-y divide-[var(--border-default)]">
                  {groupedNotifications[date].map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-[var(--bg-secondary)] transition-colors ${
                        !notification.read ? 'bg-[var(--accent-primary)]/5' : ''
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="shrink-0 text-2xl">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-medium ${getNotificationColor(notification.type)}`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)] mt-1">
                                {notification.message}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!notification.read && (
                                <Badge className="bg-[var(--accent-primary)] text-white text-xs">
                                  ใหม่
                                </Badge>
                              )}
                              {notification.url && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <Link href={notification.url}>
                                    <ExternalLink className="w-4 h-4" />
                                  </Link>
                                </Button>
                              )}
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale: th,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
            <span>
              แสดง {filteredNotifications.length} จาก {notifications.length} รายการ
            </span>
            <Link
              href="/settings/notifications"
              className="text-[var(--accent-primary)] hover:underline"
            >
              ตั้งค่าการแจ้งเตือน
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
