'use server'

import { prisma } from '@/lib/prisma'
import { sendEmail, lowStockAlertEmail, prApprovalRequestEmail, getEmailStatus as getEmailStatusLib } from '@/lib/email'
import { getSession } from '@/lib/auth'
import type { AppNotification, NotificationType } from '@/lib/notifications'
import type { ActionResult } from '@/types'
import { serialize } from '@/lib/serialize'
import { shouldNotifyUser, type NotificationTypeKey } from '@/actions/user-notification-preferences'

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
          { userId: null }, // Broadcast notifications
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

// Create a new in-app notification with delivery tracking
export async function createNotification({
  userId,
  type,
  title,
  message,
  url,
  sendLine = false,
  sendEmail = false,
}: {
  userId?: string | null // null = broadcast
  type: NotificationType
  title: string
  message: string
  url?: string
  sendLine?: boolean // Also send via LINE
  sendEmail?: boolean // Also send via Email
}): Promise<ActionResult<{ id: string }>> {
  try {
    // Create notification with delivery log for WEB channel
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

    // Log successful notification creation
    console.log(`[Notification] Created: type=${type}, userId=${userId || 'broadcast'}, title="${title}"`)

    return { success: true, data: { id: notification.id } }
  } catch (error) {
    console.error('[Notification] Failed to create:', {
      type,
      userId: userId || 'broadcast',
      title,
      error,
    })
    return { success: false, error: 'ไม่สามารถสร้างการแจ้งเตือนได้' }
  }
}

// Create notification and send to all channels
export async function createAndSendNotification({
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
}): Promise<ActionResult<{ id: string; deliveryResults: { channel: string; success: boolean; error?: string }[] }>> {
  try {
    // Create notification first
    const notification = await prisma.notification.create({
      data: {
        userId: userId || null,
        type,
        title,
        message,
        url,
        read: false,
      },
    })

    const deliveryResults: { channel: string; success: boolean; error?: string }[] = []

    // Log WEB delivery
    await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: 'WEB',
        status: 'SENT',
        recipientId: userId,
        sentAt: new Date(),
      },
    })
    deliveryResults.push({ channel: 'WEB', success: true })

    console.log(`[Notification] Created and delivered: type=${type}, userId=${userId || 'broadcast'}, title="${title}"`)

    return { 
      success: true, 
      data: { 
        id: notification.id,
        deliveryResults,
      } 
    }
  } catch (error) {
    console.error('[Notification] Failed to create:', error)
    return { success: false, error: 'ไม่สามารถสร้างการแจ้งเตือนได้' }
  }
}

// Log LINE delivery result
export async function logLineDelivery(
  notificationId: string,
  recipientId: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    await prisma.notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: 'LINE',
        status: success ? 'SENT' : 'FAILED',
        recipientId,
        error,
        sentAt: success ? new Date() : null,
      },
    })
  } catch (err) {
    console.error('[Notification] Failed to log LINE delivery:', err)
  }
}

/**
 * Create a notification and log LINE delivery in one operation
 * Use this for LINE-only notifications that need to be tracked
 * @deprecated Use logNotificationDelivery instead
 */
export async function createNotificationWithLineDelivery({
  type,
  title,
  message,
  url,
  recipientIds,
  success,
  error,
}: {
  type: string
  title: string
  message: string
  url?: string
  recipientIds: string[]
  success: boolean
  error?: string
}): Promise<void> {
  return logNotificationDelivery({ channel: 'LINE', type, title, message, url, recipientIds, success, error })
}

// Log Email delivery result
export async function logEmailDelivery(
  notificationId: string,
  recipientId: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    await prisma.notificationDeliveryLog.create({
      data: {
        notificationId,
        channel: 'EMAIL',
        status: success ? 'SENT' : 'FAILED',
        recipientId,
        error,
        sentAt: success ? new Date() : null,
      },
    })
  } catch (err) {
    console.error('[Notification] Failed to log Email delivery:', err)
  }
}

/**
 * Unified delivery logging: create a notification record and log delivery for any channel.
 * Replaces createNotificationWithLineDelivery, logLineDelivery (broadcast), and logEmailDelivery (broadcast).
 */
export async function logNotificationDelivery(params: {
  channel: 'WEB' | 'LINE' | 'EMAIL'
  type: string
  title: string
  message: string
  url?: string
  recipientIds: string[]
  success: boolean
  error?: string
}): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        type: params.type,
        title: params.title,
        message: params.message,
        url: params.url,
        read: false,
      },
    })

    if (params.recipientIds.length > 0) {
      await prisma.notificationDeliveryLog.createMany({
        data: params.recipientIds.map(recipientId => ({
          notificationId: notification.id,
          channel: params.channel,
          status: params.success ? 'SENT' as const : 'FAILED' as const,
          recipientId,
          error: params.error,
          sentAt: params.success ? new Date() : null,
        })),
      })
    }
  } catch (err) {
    console.error(`[Notification] Failed to log ${params.channel} delivery:`, err)
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

// ============================================
// Email Notifications
// ============================================

export async function sendLowStockAlert() {
  console.log('[Email] Starting low stock alert...')
  
  // Find admins and approvers to notify
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] },
      email: { not: null },
    },
    select: { id: true, email: true },
  })

  if (recipients.length === 0) {
    console.log('[Email] Low stock alert: No recipients found')
    return { success: false, error: 'No recipients found' }
  }

  // Filter recipients based on their notification preferences
  const notificationType: NotificationTypeKey = 'lowStock'
  const eligibleRecipients: string[] = []
  
  for (const recipient of recipients) {
    const shouldSend = await shouldNotifyUser(recipient.id, notificationType, 'email')
    if (shouldSend && recipient.email) {
      eligibleRecipients.push(recipient.email)
    }
  }

  if (eligibleRecipients.length === 0) {
    console.log('[Email] Low stock alert: No recipients with email enabled')
    return { success: true, message: 'No recipients with email enabled' }
  }

  // Find low stock items
  // For products without variants: check product.stockType = STOCKED
  // For variants: check variant.stockType = STOCKED
  const lowStockItems = await prisma.stockBalance.findMany({
    where: {
      product: {
        active: true,
        deletedAt: null,
      },
      OR: [
        // Products without variants: stockType = STOCKED
        { variantId: null, product: { stockType: 'STOCKED', reorderPoint: { gt: 0 } } },
        // Variants: variant.stockType = STOCKED
        { variant: { stockType: 'STOCKED' } },
      ],
    },
    include: {
      product: true,
      variant: true,
    },
  })

  const criticalItems = lowStockItems
    .filter((item) => {
      const rop = item.variant 
        ? (Number(item.variant.reorderPoint) || Number(item.product.reorderPoint))
        : Number(item.product.reorderPoint)
      return rop > 0 && Number(item.qtyOnHand) <= rop
    })
    .map((item) => ({
      name: item.variant 
        ? `${item.product.name} - ${item.variant.name || item.variant.sku}`
        : item.product.name,
      sku: item.variant ? item.variant.sku : item.product.sku,
      qty: Number(item.qtyOnHand),
      reorderPoint: item.variant 
        ? (Number(item.variant.reorderPoint) || Number(item.product.reorderPoint))
        : Number(item.product.reorderPoint),
    }))

  if (criticalItems.length === 0) {
    console.log('[Email] Low stock alert: No items below reorder point')
    return { success: true, message: 'No low stock items' }
  }

  const html = lowStockAlertEmail(criticalItems)

  console.log(`[Email] Sending low stock alert to ${eligibleRecipients.length} recipients for ${criticalItems.length} items`)
  
  const result = await sendEmail({
    to: eligibleRecipients,
    subject: `[แจ้งเตือน] สินค้าใกล้หมด ${criticalItems.length} รายการ`,
    html,
  })

  if (result.success) {
    console.log('[Email] Low stock alert sent successfully')
  } else {
    console.error('[Email] Low stock alert failed:', result.error)
  }

  return result
}

export async function sendPRApprovalRequest(prId: string) {
  console.log(`[Email] Starting PR approval request for prId=${prId}`)
  
  const pr = await prisma.pR.findUnique({
    where: { id: prId },
    include: {
      requester: true,
      _count: { select: { lines: true } },
    },
  })

  if (!pr) {
    console.error(`[Email] PR approval request failed: PR not found (prId=${prId})`)
    return { success: false, error: 'PR not found' }
  }

  // Find approvers
  const approvers = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'APPROVER'] },
      email: { not: null },
    },
    select: { email: true },
  })

  if (approvers.length === 0) {
    console.log(`[Email] PR approval request: No approvers with email found`)
    return { success: false, error: 'No approvers found' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const html = prApprovalRequestEmail({
    prNumber: pr.prNumber,
    requesterName: pr.requester.name,
    itemCount: pr._count.lines,
    url: `${baseUrl}/pr/${pr.id}`,
  })

  const emails = approvers.map((a) => a.email).filter((e): e is string => e !== null)

  console.log(`[Email] Sending PR approval request for ${pr.prNumber} to ${emails.length} approvers`)
  
  const result = await sendEmail({
    to: emails,
    subject: `[รออนุมัติ] ใบขอซื้อ ${pr.prNumber}`,
    html,
  })

  if (result.success) {
    console.log(`[Email] PR approval request sent successfully for ${pr.prNumber}`)
  } else {
    console.error(`[Email] PR approval request failed for ${pr.prNumber}:`, result.error)
  }

  return result
}

/**
 * Send PR approval request email to a specific recipient
 * Used when respecting user preferences
 */
export async function sendPRApprovalEmail(prId: string, recipientEmail: string) {
  console.log(`[Email] Sending PR approval request to ${recipientEmail}`)
  
  const pr = await prisma.pR.findUnique({
    where: { id: prId },
    include: {
      requester: true,
      _count: { select: { lines: true } },
    },
  })

  if (!pr) {
    return { success: false, error: 'PR not found' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const html = prApprovalRequestEmail({
    prNumber: pr.prNumber,
    requesterName: pr.requester.name,
    itemCount: pr._count.lines,
    url: `${baseUrl}/pr/${pr.id}`,
  })

  const result = await sendEmail({
    to: recipientEmail,
    subject: `[รออนุมัติ] ใบขอซื้อ ${pr.prNumber}`,
    html,
  })

  return result
}

export async function sendPOApprovalNotification(poId: string) {
  console.log(`[Email] Starting PO approval notification for poId=${poId}`)
  
  const po = await prisma.pO.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      createdBy: true,
    },
  })

  if (!po) {
    console.error(`[Email] PO approval notification failed: PO not found (poId=${poId})`)
    return { success: false, error: 'PO not found' }
  }

  if (!po.createdBy.email) {
    console.log(`[Email] PO approval notification: Creator has no email (${po.poNumber})`)
    return { success: false, error: 'No creator email' }
  }

  const { poApprovedEmail } = await import('@/lib/email')
  const html = poApprovedEmail({
    poNumber: po.poNumber,
    supplierName: po.supplier.name,
    total: Number(po.total),
  })

  console.log(`[Email] Sending PO approval notification for ${po.poNumber} to ${po.createdBy.email}`)
  
  const result = await sendEmail({
    to: po.createdBy.email,
    subject: `[อนุมัติแล้ว] ใบสั่งซื้อ ${po.poNumber}`,
    html,
  })

  if (result.success) {
    console.log(`[Email] PO approval notification sent successfully for ${po.poNumber}`)
  } else {
    console.error(`[Email] PO approval notification failed for ${po.poNumber}:`, result.error)
  }

  return result
}

/**
 * Send PO approval email to a specific recipient
 * Used when respecting user preferences
 */
export async function sendPOApprovalEmail(poId: string, recipientEmail: string) {
  console.log(`[Email] Sending PO approval notification to ${recipientEmail}`)
  
  const po = await prisma.pO.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
    },
  })

  if (!po) {
    return { success: false, error: 'PO not found' }
  }

  const { poApprovedEmail } = await import('@/lib/email')
  const html = poApprovedEmail({
    poNumber: po.poNumber,
    supplierName: po.supplier.name,
    total: Number(po.total),
  })

  const result = await sendEmail({
    to: recipientEmail,
    subject: `[อนุมัติแล้ว] ใบสั่งซื้อ ${po.poNumber}`,
    html,
  })

  return result
}
