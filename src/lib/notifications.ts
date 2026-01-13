// Push Notification utilities

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  tag?: string
  url?: string
  data?: Record<string, unknown>
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 
    'serviceWorker' in navigator && 
    'PushManager' in window &&
    'Notification' in window
}

// Request permission for notifications
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported')
    return 'denied'
  }

  const permission = await Notification.requestPermission()
  return permission
}

// Get current notification permission
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}

// Show a local notification (no server push required)
export async function showLocalNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported')
    return false
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return false
  }

  try {
    // Try to use service worker if available
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      tag: payload.tag,
      data: payload.data,
    })
    return true
  } catch (error) {
    // Fallback to basic Notification API
    try {
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/favicon.ico',
        tag: payload.tag,
      })
      return true
    } catch (e) {
      console.error('Failed to show notification:', e)
      return false
    }
  }
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('Service Worker registered:', registration.scope)
    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

// Notification types for the app
export type NotificationType = 
  | 'low_stock'
  | 'pr_pending'
  | 'po_pending'
  | 'po_overdue'
  | 'grn_received'
  | 'stock_take'
  | 'expiring_soon'
  | 'system'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  url?: string
  read: boolean
  createdAt: Date
}

// Get notification color based on type
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'low_stock':
    case 'po_overdue':
    case 'expiring_soon':
      return 'text-[var(--status-danger)]'
    case 'pr_pending':
    case 'po_pending':
      return 'text-[var(--status-warning)]'
    case 'grn_received':
    case 'stock_take':
      return 'text-[var(--status-success)]'
    default:
      return 'text-[var(--accent-primary)]'
  }
}

// Get notification icon based on type
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'low_stock':
      return '📦'
    case 'pr_pending':
      return '📋'
    case 'po_pending':
      return '🛒'
    case 'po_overdue':
      return '⏰'
    case 'grn_received':
      return '✅'
    case 'stock_take':
      return '📊'
    case 'expiring_soon':
      return '⚠️'
    default:
      return '🔔'
  }
}
