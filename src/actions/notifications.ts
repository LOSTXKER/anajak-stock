'use server'

import { prisma } from '@/lib/prisma'
import { getEmailStatus as getEmailStatusLib } from '@/lib/email'
import { getSession } from '@/lib/auth'
import type { AppNotification, NotificationType } from '@/lib/notifications'
import type { ActionResult } from '@/types'

// ============================================
// Service Status
// ============================================

export async function getEmailStatus(): Promise<ActionResult<{ 
  configured: boolean
  fromEmail: string
  message: string 
}>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  const status = getEmailStatusLib()
  return { success: true, data: status }
}

// ============================================
// In-App Notifications
// ============================================

export async function getNotifications(): Promise<ActionResult<AppNotification[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: session.id },
          { userId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const data: AppNotification[] = notifications.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      url: n.url || undefined,
      read: n.read,
      createdAt: n.createdAt,
    }))

    return { success: true, data }
  } catch (error) {
    console.error('Error getting notifications:', error)
    return { success: false, error: 'ไม่สามารถโหลดการแจ้งเตือนได้' }
  }
}

export async function markNotificationAsRead(id: string): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    await prisma.notification.updateMany({
      where: {
        id,
        OR: [
          { userId: session.id },
          { userId: null },
        ],
      },
      data: { read: true },
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return { success: false, error: 'ไม่สามารถอัพเดทได้' }
  }
}

export async function markAllNotificationsAsRead(): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    await prisma.notification.updateMany({
      where: {
        OR: [
          { userId: session.id },
          { userId: null },
        ],
        read: false,
      },
      data: { read: true },
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return { success: false, error: 'ไม่สามารถอัพเดทได้' }
  }
}

/**
 * Create a new in-app notification with delivery tracking.
 * For multi-channel dispatch, use dispatchNotification() from notification-dispatcher.ts instead.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  url,
}: {
  userId?: string | null
  type: NotificationType
  title: string
  message: string
  url?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: userId || null,
        type,
        title,
        message,
        url,
        read: false,
        deliveryLogs: {
          create: {
            channel: 'WEB',
            status: 'SENT',
            recipientId: userId,
            sentAt: new Date(),
          },
        },
      },
    })

    return { success: true, data: { id: notification.id } }
  } catch (error) {
    console.error('[Notification] Failed to create:', { type, userId, title, error })
    return { success: false, error: 'ไม่สามารถสร้างการแจ้งเตือนได้' }
  }
}

// Delete old notifications (cleanup)
export async function cleanupOldNotifications(daysOld: number = 30): Promise<ActionResult<{ count: number }>> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        read: true,
      },
    })

    return { success: true, data: { count: result.count } }
  } catch (error) {
    console.error('Error cleaning up notifications:', error)
    return { success: false, error: 'ไม่สามารถลบการแจ้งเตือนเก่าได้' }
  }
}
