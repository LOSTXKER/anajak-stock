// Service Worker for Push Notifications

const CACHE_NAME = 'anajak-stock-v1'

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated')
  event.waitUntil(clients.claim())
})

// Push event - when receiving a push notification from server
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event)

  let data = {
    title: 'ระบบคลังสินค้า',
    body: 'คุณมีการแจ้งเตือนใหม่',
    icon: '/favicon.ico',
    url: '/',
  }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch (e) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'notification',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'open',
        title: 'เปิดดู',
      },
      {
        action: 'close',
        title: 'ปิด',
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)

  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag)
  
  if (event.tag === 'sync-stock') {
    event.waitUntil(syncStock())
  }
})

async function syncStock() {
  // Placeholder for background sync logic
  console.log('Syncing stock data...')
}

// Periodic sync for scheduled tasks
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-low-stock') {
    event.waitUntil(checkLowStock())
  }
})

async function checkLowStock() {
  // Placeholder for low stock check
  console.log('Checking low stock...')
}
