'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/types'
import { revalidatePath } from 'next/cache'

// ============================================
// Types
// ============================================

// Channel settings for each notification type
export interface NotificationChannels {
  web: boolean
  line: boolean
  email: boolean
}

// Granular per-type per-channel preferences
export interface UserNotificationPreferences {
  // Stock alerts
  lowStock: NotificationChannels
  expiring: NotificationChannels
  movementPosted: NotificationChannels
  movementPending: NotificationChannels
  
  // PR alerts
  prPending: NotificationChannels
  prApproved: NotificationChannels
  prRejected: NotificationChannels
  
  // PO alerts
  poPending: NotificationChannels
  poApproved: NotificationChannels
  poRejected: NotificationChannels
  poSent: NotificationChannels
  poCancelled: NotificationChannels
  poReceived: NotificationChannels
  
  // GRN & Stock Take
  grnCreated: NotificationChannels
  stockTake: NotificationChannels
  
  // LINE specific
  lineUserId: string | null
}

const DEFAULT_CHANNELS: NotificationChannels = {
  web: true,
  line: true,
  email: true,
}

const DEFAULT_CHANNELS_WEB_ONLY: NotificationChannels = {
  web: true,
  line: false,
  email: false,
}

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  lowStock: { ...DEFAULT_CHANNELS },
  expiring: { ...DEFAULT_CHANNELS },
  movementPosted: { ...DEFAULT_CHANNELS_WEB_ONLY },
  movementPending: { ...DEFAULT_CHANNELS_WEB_ONLY },
  prPending: { ...DEFAULT_CHANNELS },
  prApproved: { ...DEFAULT_CHANNELS },
  prRejected: { ...DEFAULT_CHANNELS },
  poPending: { ...DEFAULT_CHANNELS },
  poApproved: { ...DEFAULT_CHANNELS },
  poRejected: { ...DEFAULT_CHANNELS },
  poSent: { web: true, line: true, email: false },
  poCancelled: { web: true, line: true, email: false },
  poReceived: { ...DEFAULT_CHANNELS },
  grnCreated: { ...DEFAULT_CHANNELS_WEB_ONLY },
  stockTake: { ...DEFAULT_CHANNELS_WEB_ONLY },
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
      data: dbToPreferences(prefs),
    }
  } catch (error) {
    console.error('Error getting user notification preferences:', error)
    return { success: false, error: 'ไม่สามารถโหลดการตั้งค่าได้' }
  }
}

// Helper to convert DB record to preferences object
function dbToPreferences(prefs: {
  lowStockWeb: boolean
  lowStockLine: boolean
  lowStockEmail: boolean
  expiringWeb: boolean
  expiringLine: boolean
  expiringEmail: boolean
  movementPostedWeb: boolean
  movementPostedLine: boolean
  movementPostedEmail: boolean
  movementPendingWeb?: boolean
  movementPendingLine?: boolean
  movementPendingEmail?: boolean
  prPendingWeb: boolean
  prPendingLine: boolean
  prPendingEmail: boolean
  prApprovedWeb: boolean
  prApprovedLine: boolean
  prApprovedEmail: boolean
  prRejectedWeb: boolean
  prRejectedLine: boolean
  prRejectedEmail: boolean
  poPendingWeb: boolean
  poPendingLine: boolean
  poPendingEmail: boolean
  poApprovedWeb: boolean
  poApprovedLine: boolean
  poApprovedEmail: boolean
  poRejectedWeb: boolean
  poRejectedLine: boolean
  poRejectedEmail: boolean
  poSentWeb?: boolean
  poSentLine?: boolean
  poSentEmail?: boolean
  poCancelledWeb?: boolean
  poCancelledLine?: boolean
  poCancelledEmail?: boolean
  poReceivedWeb: boolean
  poReceivedLine: boolean
  poReceivedEmail: boolean
  grnCreatedWeb: boolean
  grnCreatedLine: boolean
  grnCreatedEmail: boolean
  stockTakeWeb: boolean
  stockTakeLine: boolean
  stockTakeEmail: boolean
  lineUserId: string | null
}): UserNotificationPreferences {
  return {
    lowStock: { web: prefs.lowStockWeb, line: prefs.lowStockLine, email: prefs.lowStockEmail },
    expiring: { web: prefs.expiringWeb, line: prefs.expiringLine, email: prefs.expiringEmail },
    movementPosted: { web: prefs.movementPostedWeb, line: prefs.movementPostedLine, email: prefs.movementPostedEmail },
    movementPending: { web: prefs.movementPendingWeb ?? true, line: prefs.movementPendingLine ?? false, email: prefs.movementPendingEmail ?? false },
    prPending: { web: prefs.prPendingWeb, line: prefs.prPendingLine, email: prefs.prPendingEmail },
    prApproved: { web: prefs.prApprovedWeb, line: prefs.prApprovedLine, email: prefs.prApprovedEmail },
    prRejected: { web: prefs.prRejectedWeb, line: prefs.prRejectedLine, email: prefs.prRejectedEmail },
    poPending: { web: prefs.poPendingWeb, line: prefs.poPendingLine, email: prefs.poPendingEmail },
    poApproved: { web: prefs.poApprovedWeb, line: prefs.poApprovedLine, email: prefs.poApprovedEmail },
    poRejected: { web: prefs.poRejectedWeb, line: prefs.poRejectedLine, email: prefs.poRejectedEmail },
    poSent: { web: prefs.poSentWeb ?? true, line: prefs.poSentLine ?? true, email: prefs.poSentEmail ?? false },
    poCancelled: { web: prefs.poCancelledWeb ?? true, line: prefs.poCancelledLine ?? true, email: prefs.poCancelledEmail ?? false },
    poReceived: { web: prefs.poReceivedWeb, line: prefs.poReceivedLine, email: prefs.poReceivedEmail },
    grnCreated: { web: prefs.grnCreatedWeb, line: prefs.grnCreatedLine, email: prefs.grnCreatedEmail },
    stockTake: { web: prefs.stockTakeWeb, line: prefs.stockTakeLine, email: prefs.stockTakeEmail },
    lineUserId: prefs.lineUserId,
  }
}

// Helper to convert preferences object to DB fields
function preferencesToDb(prefs: Partial<UserNotificationPreferences>) {
  const result: Record<string, boolean | string | null> = {}
  
  if (prefs.lowStock) {
    result.lowStockWeb = prefs.lowStock.web
    result.lowStockLine = prefs.lowStock.line
    result.lowStockEmail = prefs.lowStock.email
  }
  if (prefs.expiring) {
    result.expiringWeb = prefs.expiring.web
    result.expiringLine = prefs.expiring.line
    result.expiringEmail = prefs.expiring.email
  }
  if (prefs.movementPosted) {
    result.movementPostedWeb = prefs.movementPosted.web
    result.movementPostedLine = prefs.movementPosted.line
    result.movementPostedEmail = prefs.movementPosted.email
  }
  if (prefs.movementPending) {
    result.movementPendingWeb = prefs.movementPending.web
    result.movementPendingLine = prefs.movementPending.line
    result.movementPendingEmail = prefs.movementPending.email
  }
  if (prefs.prPending) {
    result.prPendingWeb = prefs.prPending.web
    result.prPendingLine = prefs.prPending.line
    result.prPendingEmail = prefs.prPending.email
  }
  if (prefs.prApproved) {
    result.prApprovedWeb = prefs.prApproved.web
    result.prApprovedLine = prefs.prApproved.line
    result.prApprovedEmail = prefs.prApproved.email
  }
  if (prefs.prRejected) {
    result.prRejectedWeb = prefs.prRejected.web
    result.prRejectedLine = prefs.prRejected.line
    result.prRejectedEmail = prefs.prRejected.email
  }
  if (prefs.poPending) {
    result.poPendingWeb = prefs.poPending.web
    result.poPendingLine = prefs.poPending.line
    result.poPendingEmail = prefs.poPending.email
  }
  if (prefs.poApproved) {
    result.poApprovedWeb = prefs.poApproved.web
    result.poApprovedLine = prefs.poApproved.line
    result.poApprovedEmail = prefs.poApproved.email
  }
  if (prefs.poRejected) {
    result.poRejectedWeb = prefs.poRejected.web
    result.poRejectedLine = prefs.poRejected.line
    result.poRejectedEmail = prefs.poRejected.email
  }
  if (prefs.poSent) {
    result.poSentWeb = prefs.poSent.web
    result.poSentLine = prefs.poSent.line
    result.poSentEmail = prefs.poSent.email
  }
  if (prefs.poCancelled) {
    result.poCancelledWeb = prefs.poCancelled.web
    result.poCancelledLine = prefs.poCancelled.line
    result.poCancelledEmail = prefs.poCancelled.email
  }
  if (prefs.poReceived) {
    result.poReceivedWeb = prefs.poReceived.web
    result.poReceivedLine = prefs.poReceived.line
    result.poReceivedEmail = prefs.poReceived.email
  }
  if (prefs.grnCreated) {
    result.grnCreatedWeb = prefs.grnCreated.web
    result.grnCreatedLine = prefs.grnCreated.line
    result.grnCreatedEmail = prefs.grnCreated.email
  }
  if (prefs.stockTake) {
    result.stockTakeWeb = prefs.stockTake.web
    result.stockTakeLine = prefs.stockTake.line
    result.stockTakeEmail = prefs.stockTake.email
  }
  if (prefs.lineUserId !== undefined) {
    result.lineUserId = prefs.lineUserId
  }
  
  return result
}

export async function updateUserNotificationPreferences(
  preferences: Partial<UserNotificationPreferences>
): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const dbData = preferencesToDb(preferences)
    const defaultDbData = preferencesToDb(DEFAULT_PREFERENCES)
    
    await prisma.userNotificationPreference.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        ...defaultDbData,
        ...dbData,
      },
      update: dbData,
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

    return dbToPreferences(prefs)
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
