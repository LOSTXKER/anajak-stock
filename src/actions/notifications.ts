'use server'

import { prisma } from '@/lib/prisma'
import { sendEmail, lowStockAlertEmail, prApprovalRequestEmail, getEmailStatus as getEmailStatusLib } from '@/lib/email'
import { getSession } from '@/lib/auth'
import type { AppNotification, NotificationType } from '@/lib/notifications'
import type { ActionResult } from '@/types'
import { serialize } from '@/lib/serialize'

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

// Create a new in-app notification
export async function createNotification({
  userId,
  type,
  title,
  message,
  url,
}: {
  userId?: string | null // null = broadcast
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
    select: { email: true },
  })

  if (recipients.length === 0) {
    console.log('[Email] Low stock alert: No recipients found')
    return { success: false, error: 'No recipients found' }
  }

  // Find low stock items (only STOCKED products)
  const lowStockItems = await prisma.stockBalance.findMany({
    where: {
      product: {
        reorderPoint: { gt: 0 },
        active: true,
        deletedAt: null,
        stockType: 'STOCKED', // Only alert for stocked products
      },
    },
    include: {
      product: true,
    },
  })

  const criticalItems = lowStockItems
    .filter((item) => Number(item.qtyOnHand) <= Number(item.product.reorderPoint))
    .map((item) => ({
      name: item.product.name,
      sku: item.product.sku,
      qty: Number(item.qtyOnHand),
      reorderPoint: Number(item.product.reorderPoint),
    }))

  if (criticalItems.length === 0) {
    console.log('[Email] Low stock alert: No items below reorder point')
    return { success: true, message: 'No low stock items' }
  }

  const emails = recipients.map((r) => r.email).filter((e): e is string => e !== null)
  const html = lowStockAlertEmail(criticalItems)

  console.log(`[Email] Sending low stock alert to ${emails.length} recipients for ${criticalItems.length} items`)
  
  const result = await sendEmail({
    to: emails,
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
