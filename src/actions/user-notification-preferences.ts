'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/types'
import { revalidatePath } from 'next/cache'

// ============================================
// Types
// ============================================

export interface UserNotificationPreferences {
  // Channel toggles
  webEnabled: boolean
  lineEnabled: boolean
  emailEnabled: boolean
  // Notification type toggles
  notifyLowStock: boolean
  notifyPRPending: boolean
  notifyPRApproved: boolean
  notifyPRRejected: boolean
  notifyPOPending: boolean
  notifyPOApproved: boolean
  notifyPORejected: boolean
  notifyPOReceived: boolean
  notifyMovementPosted: boolean
  notifyExpiring: boolean
  // LINE specific
  lineUserId: string | null
}

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  webEnabled: true,
  lineEnabled: true,
  emailEnabled: true,
  notifyLowStock: true,
  notifyPRPending: true,
  notifyPRApproved: true,
  notifyPRRejected: true,
  notifyPOPending: true,
  notifyPOApproved: true,
  notifyPORejected: true,
  notifyPOReceived: true,
  notifyMovementPosted: false,
  notifyExpiring: true,
  lineUserId: null,
}

// ============================================
// Actions
// ============================================

export async function getUserNotificationPreferences(): Promise<ActionResult<UserNotificationPreferences>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const prefs = await prisma.userNotificationPreference.findUnique({
      where: { userId: session.id },
    })

    if (!prefs) {
      return { success: true, data: DEFAULT_PREFERENCES }
    }

    return {
      success: true,
      data: {
        webEnabled: prefs.webEnabled,
        lineEnabled: prefs.lineEnabled,
        emailEnabled: prefs.emailEnabled,
        notifyLowStock: prefs.notifyLowStock,
        notifyPRPending: prefs.notifyPRPending,
        notifyPRApproved: prefs.notifyPRApproved,
        notifyPRRejected: prefs.notifyPRRejected,
        notifyPOPending: prefs.notifyPOPending,
        notifyPOApproved: prefs.notifyPOApproved,
        notifyPORejected: prefs.notifyPORejected,
        notifyPOReceived: prefs.notifyPOReceived,
        notifyMovementPosted: prefs.notifyMovementPosted,
        notifyExpiring: prefs.notifyExpiring,
        lineUserId: prefs.lineUserId,
      },
    }
  } catch (error) {
    console.error('Error getting user notification preferences:', error)
    return { success: false, error: 'ไม่สามารถโหลดการตั้งค่าได้' }
  }
}

export async function updateUserNotificationPreferences(
  preferences: Partial<UserNotificationPreferences>
): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    await prisma.userNotificationPreference.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        ...DEFAULT_PREFERENCES,
        ...preferences,
      },
      update: preferences,
    })

    revalidatePath('/settings/notifications')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error updating user notification preferences:', error)
    return { success: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้' }
  }
}

// Get preferences for a specific user (used when sending notifications)
export async function getUserPreferencesForNotification(userId: string): Promise<UserNotificationPreferences | null> {
  try {
    const prefs = await prisma.userNotificationPreference.findUnique({
      where: { userId },
    })

    if (!prefs) {
      return DEFAULT_PREFERENCES
    }

    return {
      webEnabled: prefs.webEnabled,
      lineEnabled: prefs.lineEnabled,
      emailEnabled: prefs.emailEnabled,
      notifyLowStock: prefs.notifyLowStock,
      notifyPRPending: prefs.notifyPRPending,
      notifyPRApproved: prefs.notifyPRApproved,
      notifyPRRejected: prefs.notifyPRRejected,
      notifyPOPending: prefs.notifyPOPending,
      notifyPOApproved: prefs.notifyPOApproved,
      notifyPORejected: prefs.notifyPORejected,
      notifyPOReceived: prefs.notifyPOReceived,
      notifyMovementPosted: prefs.notifyMovementPosted,
      notifyExpiring: prefs.notifyExpiring,
      lineUserId: prefs.lineUserId,
    }
  } catch (error) {
    console.error('Error getting user preferences for notification:', error)
    return DEFAULT_PREFERENCES
  }
}

// ============================================
// Notification Delivery Logs
// ============================================

export interface NotificationDeliveryLogItem {
  id: string
  channel: 'WEB' | 'LINE' | 'EMAIL'
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
  recipientId: string | null
  error: string | null
  sentAt: Date | null
  createdAt: Date
  notification: {
    id: string
    type: string
    title: string
    message: string
  }
}

export async function getNotificationDeliveryLogs(
  limit: number = 50
): Promise<ActionResult<NotificationDeliveryLogItem[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  // Only admin can see all logs
  if (session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    const logs = await prisma.notificationDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        notification: {
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
          },
        },
      },
    })

    return {
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        channel: log.channel as 'WEB' | 'LINE' | 'EMAIL',
        status: log.status as 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED',
        recipientId: log.recipientId,
        error: log.error,
        sentAt: log.sentAt,
        createdAt: log.createdAt,
        notification: log.notification,
      })),
    }
  } catch (error) {
    console.error('Error getting notification delivery logs:', error)
    return { success: false, error: 'ไม่สามารถโหลดประวัติได้' }
  }
}

// Get delivery stats
export async function getNotificationDeliveryStats(): Promise<ActionResult<{
  total: number
  sent: number
  failed: number
  byChannel: { channel: string; count: number; successRate: number }[]
}>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    // Get counts by status
    const [total, sent, failed] = await Promise.all([
      prisma.notificationDeliveryLog.count(),
      prisma.notificationDeliveryLog.count({ where: { status: 'SENT' } }),
      prisma.notificationDeliveryLog.count({ where: { status: 'FAILED' } }),
    ])

    // Get counts by channel
    const channelStats = await prisma.notificationDeliveryLog.groupBy({
      by: ['channel'],
      _count: { id: true },
    })

    const channelSuccessStats = await prisma.notificationDeliveryLog.groupBy({
      by: ['channel'],
      where: { status: 'SENT' },
      _count: { id: true },
    })

    const successByChannel = new Map(
      channelSuccessStats.map((s) => [s.channel, s._count.id])
    )

    const byChannel = channelStats.map((stat) => ({
      channel: stat.channel,
      count: stat._count.id,
      successRate: stat._count.id > 0
        ? Math.round((successByChannel.get(stat.channel) || 0) / stat._count.id * 100)
        : 0,
    }))

    return {
      success: true,
      data: { total, sent, failed, byChannel },
    }
  } catch (error) {
    console.error('Error getting notification delivery stats:', error)
    return { success: false, error: 'ไม่สามารถโหลดสถิติได้' }
  }
}
