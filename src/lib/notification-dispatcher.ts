'use server'

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  type FlexContainer,
  createLineClient,
  getLineClient,
} from '@/lib/integrations/line'
import type { NotificationType } from '@/lib/notifications'
import {
  getUserEnabledChannels,
  getUserLineId,
  type NotificationTypeKey,
} from '@/actions/user-notification-preferences'

// ============================================
// Types
// ============================================

export interface DispatchParams {
  type: NotificationTypeKey
  webType?: NotificationType
  title: string
  message: string
  url?: string
  lineTemplate: { altText: string; flex: FlexContainer } | null
  emailSubject?: string
  emailHtml?: string
  targetUserIds: string[]
}

export interface DispatchResult {
  success: boolean
  deliveries: {
    userId: string
    web: boolean
    line: boolean
    email: boolean
  }[]
  lineGroupsSent: number
  errors: string[]
}

// ============================================
// LINE Settings Helper (inline to avoid circular deps)
// ============================================

interface LineSettingsData {
  enabled: boolean
  channelAccessToken: string
  channelSecret: string
  recipientUserIds: string[]
}

async function getLineSettingsInternal(): Promise<LineSettingsData | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'line_notification' },
    })
    if (!setting) return null

    const data = JSON.parse(setting.value) as Partial<LineSettingsData>
    return {
      enabled: data.enabled ?? false,
      channelAccessToken: data.channelAccessToken ?? '',
      channelSecret: data.channelSecret ?? '',
      recipientUserIds: data.recipientUserIds ?? [],
    }
  } catch {
    return null
  }
}

function getLineClientFromSettings(settings: LineSettingsData) {
  if (settings.channelAccessToken) {
    return createLineClient({ channelAccessToken: settings.channelAccessToken })
  }
  return getLineClient()
}

// ============================================
// Core Dispatcher
// ============================================

/**
 * Unified notification dispatcher.
 * Sends notifications to target users based on their per-type per-channel preferences.
 * Also sends LINE messages to group/room IDs from global settings.
 *
 * This is the ONLY function that should be used to send notifications.
 * It guarantees that preferences are always checked before sending.
 */
export async function dispatchNotification(params: DispatchParams): Promise<DispatchResult> {
  const {
    type,
    webType,
    title,
    message,
    url,
    lineTemplate,
    emailSubject,
    emailHtml,
    targetUserIds,
  } = params

  const result: DispatchResult = {
    success: true,
    deliveries: [],
    lineGroupsSent: 0,
    errors: [],
  }

  // Deduplicate target user IDs
  const uniqueUserIds = [...new Set(targetUserIds)]

  // Get LINE settings once (used for sending LINE messages)
  let lineSettings: LineSettingsData | null = null
  let lineClient: ReturnType<typeof getLineClientFromSettings> | null = null

  if (lineTemplate) {
    lineSettings = await getLineSettingsInternal()
    if (lineSettings?.enabled) {
      lineClient = getLineClientFromSettings(lineSettings)
    }
  }

  // Collect LINE user IDs to send to (batch for efficiency)
  const lineRecipients: string[] = []

  // Process each target user
  const userPromises = uniqueUserIds.map(async (userId) => {
    const delivery = { userId, web: false, line: false, email: false }

    try {
      const channels = await getUserEnabledChannels(userId, type)

      // Web notification
      if (channels.web) {
        try {
          await prisma.notification.create({
            data: {
              userId,
              type: webType || 'system',
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
          delivery.web = true
        } catch (err) {
          result.errors.push(`Web notification failed for user ${userId}: ${err}`)
        }
      }

      // LINE notification
      if (channels.line && lineTemplate && lineClient) {
        try {
          const lineUserId = await getUserLineId(userId)
          if (lineUserId) {
            lineRecipients.push(lineUserId)
            delivery.line = true
          }
        } catch (err) {
          result.errors.push(`LINE lookup failed for user ${userId}: ${err}`)
        }
      }

      // Email notification
      if (channels.email && emailSubject && emailHtml) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
          })
          if (user?.email) {
            const emailResult = await sendEmail({
              to: user.email,
              subject: emailSubject,
              html: emailHtml,
            })
            delivery.email = emailResult.success
            if (!emailResult.success) {
              result.errors.push(`Email failed for user ${userId}: ${(emailResult as { error?: string }).error}`)
            }
          }
        } catch (err) {
          result.errors.push(`Email failed for user ${userId}: ${err}`)
        }
      }
    } catch (err) {
      result.errors.push(`Preference check failed for user ${userId}: ${err}`)
    }

    result.deliveries.push(delivery)
  })

  await Promise.allSettled(userPromises)

  // Send LINE to group/room IDs from global settings
  // Groups (starting with C) and rooms (starting with R) are org-level recipients, not individual users
  if (lineTemplate && lineClient && lineSettings) {
    const groupIds = (lineSettings.recipientUserIds || []).filter(
      (id) => id.startsWith('C') || id.startsWith('R')
    )
    if (groupIds.length > 0) {
      try {
        const groupResult = await lineClient.sendFlex(
          groupIds,
          lineTemplate.altText,
          lineTemplate.flex,
        )
        if (groupResult.success) {
          result.lineGroupsSent = groupIds.length
        } else {
          result.errors.push(`LINE group send failed: ${groupResult.error}`)
        }
      } catch (err) {
        result.errors.push(`LINE group send error: ${err}`)
      }
    }
  }

  // Batch send LINE to all individual user recipients
  if (lineTemplate && lineClient && lineRecipients.length > 0) {
    const uniqueLineIds = [...new Set(lineRecipients)]
    try {
      const lineResult = await lineClient.sendFlex(
        uniqueLineIds,
        lineTemplate.altText,
        lineTemplate.flex,
      )
      if (!lineResult.success) {
        result.errors.push(`LINE batch send failed: ${lineResult.error}`)
        // Mark LINE deliveries as failed
        for (const d of result.deliveries) {
          if (d.line) d.line = false
        }
      }
    } catch (err) {
      result.errors.push(`LINE batch send error: ${err}`)
      for (const d of result.deliveries) {
        if (d.line) d.line = false
      }
    }

    // Log LINE delivery
    try {
      const notification = await prisma.notification.create({
        data: {
          type: webType || 'system',
          title,
          message,
          url,
          read: false,
        },
      })
      await prisma.notificationDeliveryLog.createMany({
        data: uniqueLineIds.map((recipientId) => ({
          notificationId: notification.id,
          channel: 'LINE',
          status: 'SENT' as const,
          recipientId,
          sentAt: new Date(),
        })),
      })
    } catch {
      // Delivery logging is best-effort
    }
  }

  if (result.errors.length > 0) {
    console.error('[Dispatcher] Errors:', result.errors)
  }

  return result
}
