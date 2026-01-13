'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Check, X, ExternalLink, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/actions/notifications'
import {
  isPushSupported,
  requestNotificationPermission,
  getNotificationPermission,
  registerServiceWorker,
  getNotificationIcon,
  getNotificationColor,
  type AppNotification,
} from '@/lib/notifications'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default')
  const [showSettings, setShowSettings] = useState(false)

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const result = await getNotifications()
      if (result.success && result.data) {
        setNotifications(result.data)
        setUnreadCount(result.data.filter((n) => !n.read).length)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize
  useEffect(() => {
    loadNotifications()

    // Check push permission
    const permission = getNotificationPermission()
    setPermissionStatus(permission)

    // Register service worker
    if (isPushSupported()) {
      registerServiceWorker()
    }

    // Poll for new notifications every 60 seconds
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  async function handleEnablePush() {
    const permission = await requestNotificationPermission()
    setPermissionStatus(permission)

    if (permission === 'granted') {
      toast.success('เปิดการแจ้งเตือนเรียบร้อย')
    } else if (permission === 'denied') {
      toast.error('การแจ้งเตือนถูกปิด กรุณาเปิดในการตั้งค่าเบราว์เซอร์')
    }
  }

  async function handleMarkAsRead(id: string) {
    const result = await markNotificationAsRead(id)
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  async function handleMarkAllAsRead() {
    const result = await markAllNotificationsAsRead()
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('อ่านทั้งหมดแล้ว')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {permissionStatus === 'granted' ? (
              <Bell className="w-5 h-5" />
            ) : (
              <BellOff className="w-5 h-5 text-[var(--text-muted)]" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-[var(--status-danger)] rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-80 bg-[var(--bg-elevated)] border-[var(--border-default)]"
        >
          <div className="flex items-center justify-between px-4 py-2">
            <h3 className="font-semibold">การแจ้งเตือน</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAllAsRead}
                >
                  <Check className="w-3 h-3 mr-1" />
                  อ่านทั้งหมด
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <DropdownMenuSeparator />

          {isLoading ? (
            <div className="p-4 text-center text-[var(--text-muted)]">
              กำลังโหลด...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>ไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 10).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`p-3 cursor-pointer ${
                    !notification.read ? 'bg-[var(--accent-primary)]/5' : ''
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex gap-3 w-full">
                    <span className="text-xl">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${getNotificationColor(notification.type)}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: th,
                        })}
                      </p>
                    </div>
                    {notification.url && (
                      <Link href={notification.url} className="shrink-0">
                        <ExternalLink className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent-primary)]" />
                      </Link>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}

          {notifications.length > 10 && (
            <>
              <DropdownMenuSeparator />
              <Link href="/notifications" className="block">
                <DropdownMenuItem className="justify-center text-[var(--accent-primary)]">
                  ดูทั้งหมด ({notifications.length})
                </DropdownMenuItem>
              </Link>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notification Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              ตั้งค่าการแจ้งเตือน
            </DialogTitle>
            <DialogDescription>
              จัดการการแจ้งเตือนผ่านเบราว์เซอร์
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Push Notification Status */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-secondary)]">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {permissionStatus === 'unsupported' && 'เบราว์เซอร์ไม่รองรับ'}
                  {permissionStatus === 'granted' && 'เปิดใช้งานแล้ว'}
                  {permissionStatus === 'denied' && 'ถูกปิด - เปิดในการตั้งค่าเบราว์เซอร์'}
                  {permissionStatus === 'default' && 'ยังไม่ได้ตั้งค่า'}
                </p>
              </div>
              {permissionStatus === 'default' && (
                <Button onClick={handleEnablePush}>
                  เปิดใช้งาน
                </Button>
              )}
              {permissionStatus === 'granted' && (
                <div className="flex items-center gap-2 text-[var(--status-success)]">
                  <Check className="w-5 h-5" />
                  <span>เปิดอยู่</span>
                </div>
              )}
              {permissionStatus === 'denied' && (
                <div className="flex items-center gap-2 text-[var(--status-danger)]">
                  <X className="w-5 h-5" />
                  <span>ปิดอยู่</span>
                </div>
              )}
            </div>

            {/* Notification Types */}
            <div className="space-y-2">
              <p className="font-medium">ประเภทการแจ้งเตือน</p>
              <div className="space-y-2">
                {[
                  { type: 'low_stock', label: 'สต๊อคใกล้หมด' },
                  { type: 'pr_pending', label: 'PR รออนุมัติ' },
                  { type: 'po_pending', label: 'PO รออนุมัติ' },
                  { type: 'po_overdue', label: 'PO เกินกำหนด' },
                  { type: 'expiring_soon', label: 'สินค้าใกล้หมดอายุ' },
                ].map((item) => (
                  <label
                    key={item.type}
                    className="flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-secondary)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded"
                    />
                    <span className="text-lg">{getNotificationIcon(item.type as any)}</span>
                    <span className="text-sm">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
