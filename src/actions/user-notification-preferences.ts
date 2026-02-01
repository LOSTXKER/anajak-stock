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
  
  // Movement alerts - granular per type and status
  // RECEIVE (รับเข้า)
  receivePending: NotificationChannels
  receivePosted: NotificationChannels
  // ISSUE (เบิกออก)
  issuePending: NotificationChannels
  issuePosted: NotificationChannels
  // TRANSFER (โอนย้าย)
  transferPending: NotificationChannels
  transferPosted: NotificationChannels
  // ADJUST (ปรับปรุง)
  adjustPending: NotificationChannels
  adjustPosted: NotificationChannels
  // RETURN (คืนของ)
  returnPending: NotificationChannels
  returnPosted: NotificationChannels
  
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
  // Movement - granular per type (default: web only)
  receivePending: { ...DEFAULT_CHANNELS_WEB_ONLY },
  receivePosted: { ...DEFAULT_CHANNELS_WEB_ONLY },
  issuePending: { ...DEFAULT_CHANNELS_WEB_ONLY },
  issuePosted: { ...DEFAULT_CHANNELS_WEB_ONLY },
  transferPending: { ...DEFAULT_CHANNELS_WEB_ONLY },
  transferPosted: { ...DEFAULT_CHANNELS_WEB_ONLY },
  adjustPending: { ...DEFAULT_CHANNELS_WEB_ONLY },
  adjustPosted: { ...DEFAULT_CHANNELS_WEB_ONLY },
  returnPending: { ...DEFAULT_CHANNELS_WEB_ONLY },
  returnPosted: { ...DEFAULT_CHANNELS_WEB_ONLY },
  // PR
  prPending: { ...DEFAULT_CHANNELS },
  prApproved: { ...DEFAULT_CHANNELS },
  prRejected: { ...DEFAULT_CHANNELS },
  // PO
  poPending: { ...DEFAULT_CHANNELS },
  poApproved: { ...DEFAULT_CHANNELS },
  poRejected: { ...DEFAULT_CHANNELS },
  poSent: { web: true, line: true, email: false },
  poCancelled: { web: true, line: true, email: false },
  poReceived: { ...DEFAULT_CHANNELS },
  // GRN & Stock Take
  grnCreated: { ...DEFAULT_CHANNELS_WEB_ONLY },
  stockTake: { ...DEFAULT_CHANNELS_WEB_ONLY },
  lineUserId: null,
}

// ============================================
// Actions
// ============================================

export async function getUserNotificationPreferences(targetUserId?: string): Promise<ActionResult<UserNotificationPreferences>> {
  let userId = targetUserId

  // If no target user specified, use current session
  if (!userId) {
    const session = await getSession()
    if (!session) {
      return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
    }
    userId = session.id
  }

  try {
    const prefs = await prisma.userNotificationPreference.findUnique({
      where: { userId },
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
  // Granular movement notifications
  receivePendingWeb: boolean
  receivePendingLine: boolean
  receivePendingEmail: boolean
  receivePostedWeb: boolean
  receivePostedLine: boolean
  receivePostedEmail: boolean
  issuePendingWeb: boolean
  issuePendingLine: boolean
  issuePendingEmail: boolean
  issuePostedWeb: boolean
  issuePostedLine: boolean
  issuePostedEmail: boolean
  transferPendingWeb: boolean
  transferPendingLine: boolean
  transferPendingEmail: boolean
  transferPostedWeb: boolean
  transferPostedLine: boolean
  transferPostedEmail: boolean
  adjustPendingWeb: boolean
  adjustPendingLine: boolean
  adjustPendingEmail: boolean
  adjustPostedWeb: boolean
  adjustPostedLine: boolean
  adjustPostedEmail: boolean
  returnPendingWeb: boolean
  returnPendingLine: boolean
  returnPendingEmail: boolean
  returnPostedWeb: boolean
  returnPostedLine: boolean
  returnPostedEmail: boolean
  // PR
  prPendingWeb: boolean
  prPendingLine: boolean
  prPendingEmail: boolean
  prApprovedWeb: boolean
  prApprovedLine: boolean
  prApprovedEmail: boolean
  prRejectedWeb: boolean
  prRejectedLine: boolean
  prRejectedEmail: boolean
  // PO
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
  // GRN & Stock Take
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
    // Movement - granular per type
    receivePending: { web: prefs.receivePendingWeb, line: prefs.receivePendingLine, email: prefs.receivePendingEmail },
    receivePosted: { web: prefs.receivePostedWeb, line: prefs.receivePostedLine, email: prefs.receivePostedEmail },
    issuePending: { web: prefs.issuePendingWeb, line: prefs.issuePendingLine, email: prefs.issuePendingEmail },
    issuePosted: { web: prefs.issuePostedWeb, line: prefs.issuePostedLine, email: prefs.issuePostedEmail },
    transferPending: { web: prefs.transferPendingWeb, line: prefs.transferPendingLine, email: prefs.transferPendingEmail },
    transferPosted: { web: prefs.transferPostedWeb, line: prefs.transferPostedLine, email: prefs.transferPostedEmail },
    adjustPending: { web: prefs.adjustPendingWeb, line: prefs.adjustPendingLine, email: prefs.adjustPendingEmail },
    adjustPosted: { web: prefs.adjustPostedWeb, line: prefs.adjustPostedLine, email: prefs.adjustPostedEmail },
    returnPending: { web: prefs.returnPendingWeb, line: prefs.returnPendingLine, email: prefs.returnPendingEmail },
    returnPosted: { web: prefs.returnPostedWeb, line: prefs.returnPostedLine, email: prefs.returnPostedEmail },
    // PR
    prPending: { web: prefs.prPendingWeb, line: prefs.prPendingLine, email: prefs.prPendingEmail },
    prApproved: { web: prefs.prApprovedWeb, line: prefs.prApprovedLine, email: prefs.prApprovedEmail },
    prRejected: { web: prefs.prRejectedWeb, line: prefs.prRejectedLine, email: prefs.prRejectedEmail },
    // PO
    poPending: { web: prefs.poPendingWeb, line: prefs.poPendingLine, email: prefs.poPendingEmail },
    poApproved: { web: prefs.poApprovedWeb, line: prefs.poApprovedLine, email: prefs.poApprovedEmail },
    poRejected: { web: prefs.poRejectedWeb, line: prefs.poRejectedLine, email: prefs.poRejectedEmail },
    poSent: { web: prefs.poSentWeb ?? true, line: prefs.poSentLine ?? true, email: prefs.poSentEmail ?? false },
    poCancelled: { web: prefs.poCancelledWeb ?? true, line: prefs.poCancelledLine ?? true, email: prefs.poCancelledEmail ?? false },
    poReceived: { web: prefs.poReceivedWeb, line: prefs.poReceivedLine, email: prefs.poReceivedEmail },
    // GRN & Stock Take
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
  // Movement - granular per type
  if (prefs.receivePending) {
    result.receivePendingWeb = prefs.receivePending.web
    result.receivePendingLine = prefs.receivePending.line
    result.receivePendingEmail = prefs.receivePending.email
  }
  if (prefs.receivePosted) {
    result.receivePostedWeb = prefs.receivePosted.web
    result.receivePostedLine = prefs.receivePosted.line
    result.receivePostedEmail = prefs.receivePosted.email
  }
  if (prefs.issuePending) {
    result.issuePendingWeb = prefs.issuePending.web
    result.issuePendingLine = prefs.issuePending.line
    result.issuePendingEmail = prefs.issuePending.email
  }
  if (prefs.issuePosted) {
    result.issuePostedWeb = prefs.issuePosted.web
    result.issuePostedLine = prefs.issuePosted.line
    result.issuePostedEmail = prefs.issuePosted.email
  }
  if (prefs.transferPending) {
    result.transferPendingWeb = prefs.transferPending.web
    result.transferPendingLine = prefs.transferPending.line
    result.transferPendingEmail = prefs.transferPending.email
  }
  if (prefs.transferPosted) {
    result.transferPostedWeb = prefs.transferPosted.web
    result.transferPostedLine = prefs.transferPosted.line
    result.transferPostedEmail = prefs.transferPosted.email
  }
  if (prefs.adjustPending) {
    result.adjustPendingWeb = prefs.adjustPending.web
    result.adjustPendingLine = prefs.adjustPending.line
    result.adjustPendingEmail = prefs.adjustPending.email
  }
  if (prefs.adjustPosted) {
    result.adjustPostedWeb = prefs.adjustPosted.web
    result.adjustPostedLine = prefs.adjustPosted.line
    result.adjustPostedEmail = prefs.adjustPosted.email
  }
  if (prefs.returnPending) {
    result.returnPendingWeb = prefs.returnPending.web
    result.returnPendingLine = prefs.returnPending.line
    result.returnPendingEmail = prefs.returnPending.email
  }
  if (prefs.returnPosted) {
    result.returnPostedWeb = prefs.returnPosted.web
    result.returnPostedLine = prefs.returnPosted.line
    result.returnPostedEmail = prefs.returnPosted.email
  }
  // PR
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
  // PO
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
  // GRN & Stock Take
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
// Notification Helper Functions
// ============================================

// Notification type keys matching UserNotificationPreferences
export type NotificationTypeKey = 
  | 'lowStock'
  | 'expiring'
  // Movement - granular per type
  | 'receivePending'
  | 'receivePosted'
  | 'issuePending'
  | 'issuePosted'
  | 'transferPending'
  | 'transferPosted'
  | 'adjustPending'
  | 'adjustPosted'
  | 'returnPending'
  | 'returnPosted'
  // PR
  | 'prPending'
  | 'prApproved'
  | 'prRejected'
  // PO
  | 'poPending'
  | 'poApproved'
  | 'poRejected'
  | 'poSent'
  | 'poCancelled'
  | 'poReceived'
  // GRN & Stock Take
  | 'grnCreated'
  | 'stockTake'

/**
 * Check if a user should receive a notification via a specific channel
 */
export async function shouldNotifyUser(
  userId: string,
  notificationType: NotificationTypeKey,
  channel: 'web' | 'line' | 'email'
): Promise<boolean> {
  const prefs = await getUserPreferencesForNotification(userId)
  if (!prefs) return true // Default to send if no preferences
  
  const typePrefs = prefs[notificationType] as NotificationChannels | undefined
  if (!typePrefs) return true // Default to send if type not found
  
  return typePrefs[channel] ?? true
}

/**
 * Get users who should be notified for a specific notification type and channel
 * Returns filtered list of user IDs
 */
export async function getNotifiableUsers(
  userIds: string[],
  notificationType: NotificationTypeKey,
  channel: 'web' | 'line' | 'email'
): Promise<string[]> {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const shouldNotify = await shouldNotifyUser(userId, notificationType, channel)
      return shouldNotify ? userId : null
    })
  )
  return results.filter((id): id is string => id !== null)
}

/**
 * Get notification channels enabled for a user
 */
export async function getUserEnabledChannels(
  userId: string,
  notificationType: NotificationTypeKey
): Promise<NotificationChannels> {
  const prefs = await getUserPreferencesForNotification(userId)
  if (!prefs) {
    return { web: true, line: true, email: true }
  }
  
  const typePrefs = prefs[notificationType] as NotificationChannels | undefined
  return typePrefs ?? { web: true, line: true, email: true }
}

/**
 * Get LINE User ID for a user (if they have one set in their preferences)
 */
export async function getUserLineId(userId: string): Promise<string | null> {
  const prefs = await getUserPreferencesForNotification(userId)
  return prefs?.lineUserId ?? null
}

/**
 * Filter LINE recipient IDs by user preferences
 * Maps LINE User IDs to system users and checks their preferences
 * 
 * @param lineUserIds - Array of LINE User IDs to filter
 * @param notificationType - The notification type to check preferences for
 * @returns Filtered array of LINE User IDs that should receive the notification
 */
export async function filterLineRecipientsByPreferences(
  lineUserIds: string[],
  notificationType: NotificationTypeKey
): Promise<string[]> {
  if (lineUserIds.length === 0) {
    return []
  }

  try {
    // Find users who have set their LINE User ID in preferences
    const prefsWithLineId = await prisma.userNotificationPreference.findMany({
      where: {
        lineUserId: { in: lineUserIds },
      },
    })

    // Build a map of LINE User ID -> preferences
    const prefsMap = new Map<string, typeof prefsWithLineId[0]>()
    for (const pref of prefsWithLineId) {
      if (pref.lineUserId) {
        prefsMap.set(pref.lineUserId, pref)
      }
    }

    // Filter recipients based on their preferences
    const filteredRecipients: string[] = []

    for (const lineUserId of lineUserIds) {
      const pref = prefsMap.get(lineUserId)
      
      if (!pref) {
        // User not found in preferences - use default (send notification)
        // This handles recipients who haven't configured their preferences
        filteredRecipients.push(lineUserId)
        continue
      }

      // Check the LINE preference for this notification type
      const lineFieldName = `${notificationType}Line` as keyof typeof pref
      const isLineEnabled = pref[lineFieldName]

      // If the field doesn't exist or is true, send the notification
      if (isLineEnabled === undefined || isLineEnabled === true) {
        filteredRecipients.push(lineUserId)
      }
      // If explicitly set to false, skip this recipient
    }

    return filteredRecipients
  } catch (error) {
    console.error('Error filtering LINE recipients by preferences:', error)
    // On error, return all recipients (fail-safe to ensure notifications are sent)
    return lineUserIds
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
  recipientName: string | null
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

    // Get unique recipient IDs to lookup user names
    const recipientIds = [...new Set(logs.map(log => log.recipientId).filter(Boolean))] as string[]
    
    // Lookup users by their IDs
    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, name: true },
    })
    
    // Also lookup by LINE User ID (stored in preferences)
    const lineUserPrefs = await prisma.userNotificationPreference.findMany({
      where: { lineUserId: { in: recipientIds } },
      select: { userId: true, lineUserId: true },
    })
    
    // Get user names for LINE recipients
    const lineUserIds = lineUserPrefs.map(p => p.userId)
    const lineUsers = await prisma.user.findMany({
      where: { id: { in: lineUserIds } },
      select: { id: true, name: true },
    })
    
    // Create a map of recipientId -> user name
    const recipientNameMap: Record<string, string> = {}
    
    // Map user IDs to names
    for (const user of users) {
      recipientNameMap[user.id] = user.name
    }
    
    // Map LINE User IDs to names
    for (const pref of lineUserPrefs) {
      if (pref.lineUserId) {
        const user = lineUsers.find(u => u.id === pref.userId)
        if (user) {
          recipientNameMap[pref.lineUserId] = user.name
        }
      }
    }

    return {
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        channel: log.channel as 'WEB' | 'LINE' | 'EMAIL',
        status: log.status as 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED',
        recipientId: log.recipientId,
        recipientName: log.recipientId ? recipientNameMap[log.recipientId] || null : null,
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
