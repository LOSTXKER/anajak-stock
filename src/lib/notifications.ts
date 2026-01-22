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

// ============================================
// Notification Preferences Helpers
// ============================================

// Channel settings for each notification type
export interface NotificationChannels {
  web: boolean
  line: boolean
  email: boolean
}

// Notification preference keys (for type checking)
export type NotificationPreferenceKey = 
  | 'lowStock'
  | 'expiring'
  | 'movementPosted'
  | 'prPending'
  | 'prApproved'
  | 'prRejected'
  | 'poPending'
  | 'poApproved'
  | 'poRejected'
  | 'poReceived'
  | 'grnCreated'
  | 'stockTake'

// User notification preferences shape (for use in shouldNotify)
export interface NotificationPreferencesShape {
  lowStock: NotificationChannels
  expiring: NotificationChannels
  movementPosted: NotificationChannels
  prPending: NotificationChannels
  prApproved: NotificationChannels
  prRejected: NotificationChannels
  poPending: NotificationChannels
  poApproved: NotificationChannels
  poRejected: NotificationChannels
  poReceived: NotificationChannels
  grnCreated: NotificationChannels
  stockTake: NotificationChannels
  lineUserId: string | null
}

// Helper to check if user wants notification on specific channel for specific type
export function shouldNotify(
  prefs: NotificationPreferencesShape,
  notificationType: NotificationPreferenceKey,
  channel: 'web' | 'line' | 'email'
): boolean {
  const typePrefs = prefs[notificationType]
  if (typeof typePrefs === 'object' && typePrefs !== null) {
    return typePrefs[channel] ?? false
  }
  return false
}
