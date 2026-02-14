'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { POStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import { createNotification, sendPOApprovalNotification, sendPOApprovalEmail } from '@/actions/notifications'
import { sendLinePOStatusUpdate, sendLineNotificationToUser } from '@/actions/line-notifications'
import { 
  getUserEnabledChannels,
  getUserLineId,
  type NotificationTypeKey 
} from '@/actions/user-notification-preferences'

/**
 * Submit a PO for approval (DRAFT → SUBMITTED)
 */
export async function submitPO(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const po = await prisma.pO.findUnique({
      where: { id },
      include: { lines: true, createdBy: true },
    })

    if (!po) {
      return { success: false, error: 'ไม่พบ PO' }
    }

    if (po.status !== POStatus.DRAFT && po.status !== POStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถส่งอนุมัติ PO นี้ได้' }
    }

    if (po.lines.length === 0) {
      return { success: false, error: 'กรุณาเพิ่มรายการสินค้าก่อนส่งอนุมัติ' }
    }

    await prisma.$transaction([
      prisma.pO.update({
        where: { id },
        data: { status: POStatus.SUBMITTED },
      }),
      prisma.pOTimeline.create({
        data: {
          poId: id,
          action: 'ส่งอนุมัติ',
          note: `ส่งอนุมัติโดย ${session.name}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.id,
          action: 'SUBMIT',
          refType: 'PO',
          refId: id,
        },
      }),
    ])

    // Send notifications to approvers
    notifyPOSubmitted(id, po.poNumber, po.createdBy.name).catch((err) =>
      console.error('Failed to send PO submission notifications:', err)
    )

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'submitPO')
  }
}

/**
 * Approve a PO (SUBMITTED → APPROVED)
 */
export async function approvePO(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const po = await prisma.pO.findUnique({ where: { id } })

    if (!po) {
      return { success: false, error: 'ไม่พบ PO' }
    }

    if (po.status !== POStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถอนุมัติ PO ที่ไม่ได้รออนุมัติได้' }
    }

    await prisma.$transaction([
      prisma.pO.update({
        where: { id },
        data: {
          status: POStatus.APPROVED,
          approvedById: session.id,
          approvedAt: new Date(),
        },
      }),
      prisma.pOTimeline.create({
        data: {
          poId: id,
          action: 'อนุมัติ PO',
          note: `อนุมัติโดย ${session.name}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.id,
          action: 'APPROVE',
          refType: 'PO',
          refId: id,
        },
      }),
    ])

    // Send notifications to PO creator
    notifyPOApproved(id, po.poNumber, po.createdById, session.name).catch((err) =>
      console.error('Failed to send PO approval notifications:', err)
    )

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'approvePO')
  }
}

/**
 * Send PO to supplier
 */
export async function sendPO(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const po = await prisma.pO.findUnique({ where: { id } })

    if (!po) {
      return { success: false, error: 'ไม่พบ PO' }
    }

    if (po.status !== POStatus.APPROVED) {
      return { success: false, error: 'ไม่สามารถส่ง PO ที่ยังไม่อนุมัติได้' }
    }

    await prisma.$transaction([
      prisma.pO.update({
        where: { id },
        data: {
          status: POStatus.SENT,
          sentAt: new Date(),
        },
      }),
      prisma.pOTimeline.create({
        data: {
          poId: id,
          action: 'ส่ง PO ให้ Supplier',
          note: `ส่งโดย ${session.name}`,
        },
      }),
    ])

    // Send notifications (single entry point handles web + LINE global + LINE individual)
    notifyPOSent(id, po.poNumber, po.createdById).catch((err) =>
      console.error('Failed to send PO sent notifications:', err)
    )

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'sendPO')
  }
}

/**
 * Reject a PO (SUBMITTED → REJECTED)
 */
export async function rejectPO(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const po = await prisma.pO.findUnique({ where: { id } })

    if (!po) {
      return { success: false, error: 'ไม่พบ PO' }
    }

    if (po.status !== POStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถปฏิเสธ PO ที่ไม่ได้รออนุมัติได้' }
    }

    await prisma.$transaction([
      prisma.pO.update({
        where: { id },
        data: { 
          status: POStatus.REJECTED,
          approvedById: session.id,
          approvedAt: new Date(),
        },
      }),
      prisma.pOTimeline.create({
        data: {
          poId: id,
          action: 'ไม่อนุมัติ',
          note: reason ? `ไม่อนุมัติโดย ${session.name}: ${reason}` : `ไม่อนุมัติโดย ${session.name}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.id,
          action: 'REJECT',
          refType: 'PO',
          refId: id,
          newData: { reason },
        },
      }),
    ])

    // Send notifications based on user preferences
    notifyPORejected(id, po.poNumber, po.createdById, session.name, reason).catch((err) =>
      console.error('Failed to send PO rejection notifications:', err)
    )

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'rejectPO')
  }
}

/**
 * Cancel a PO
 */
export async function cancelPO(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const po = await prisma.pO.findUnique({
      where: { id },
      include: { grns: true },
    })

    if (!po) {
      return { success: false, error: 'ไม่พบ PO' }
    }

    if (po.grns.length > 0) {
      return { success: false, error: 'ไม่สามารถยกเลิก PO ที่มีการรับสินค้าแล้ว' }
    }

    await prisma.$transaction([
      prisma.pO.update({
        where: { id },
        data: { status: POStatus.CANCELLED },
      }),
      prisma.pOTimeline.create({
        data: {
          poId: id,
          action: 'ยกเลิก PO',
          note: reason || `ยกเลิกโดย ${session.name}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.id,
          action: 'CANCEL',
          refType: 'PO',
          refId: id,
          newData: { reason },
        },
      }),
    ])

    // Send notifications (single entry point handles web + LINE global + LINE individual)
    notifyPOCancelled(id, po.poNumber, po.createdById).catch((err) =>
      console.error('Failed to send PO cancellation notifications:', err)
    )

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'cancelPO')
  }
}

// ============================================
// Notification Helpers
// ============================================

/**
 * Send notifications when a PO is submitted for approval
 * Respects user notification preferences for each channel
 */
async function notifyPOSubmitted(poId: string, poNumber: string, requesterName: string) {
  // Get all approvers (ADMIN and APPROVER roles)
  const approvers = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'APPROVER'] },
    },
    select: { id: true, email: true },
  })

  const notificationType: NotificationTypeKey = 'poPending'

  // Send notifications based on each user's preferences
  const notificationPromises = approvers.map(async (approver) => {
    const channels = await getUserEnabledChannels(approver.id, notificationType)
    const tasks: Promise<unknown>[] = []

    // Web notification
    if (channels.web) {
      tasks.push(
        createNotification({
          userId: approver.id,
          type: 'po_pending',
          title: `PO ใหม่รออนุมัติ: ${poNumber}`,
          message: `${requesterName} ส่งใบสั่งซื้อ ${poNumber} รออนุมัติ`,
          url: `/po/${poId}`,
        })
      )
    }

    // LINE notification
    if (channels.line) {
      const lineUserId = await getUserLineId(approver.id)
      if (lineUserId) {
        tasks.push(sendLineNotificationToUser(lineUserId, 'poPending', {
          poId,
          poNumber,
        }))
      }
    }

    return Promise.allSettled(tasks)
  })

  // Also send LINE to global recipients
  const linePromise = sendLinePOStatusUpdate(poId, 'รออนุมัติ')

  await Promise.allSettled([...notificationPromises, linePromise])
}

/**
 * Send notifications when a PO is approved
 * Respects user notification preferences
 */
async function notifyPOApproved(poId: string, poNumber: string, creatorId: string, approverName: string) {
  const notificationType: NotificationTypeKey = 'poApproved'
  const channels = await getUserEnabledChannels(creatorId, notificationType)
  const tasks: Promise<unknown>[] = []

  // Get PO details for notification
  const po = await prisma.pO.findUnique({
    where: { id: poId },
    include: { supplier: true, createdBy: true },
  })

  // Web notification
  if (channels.web) {
    tasks.push(
      createNotification({
        userId: creatorId,
        type: 'po_pending',
        title: `PO ${poNumber} อนุมัติแล้ว`,
        message: `ใบสั่งซื้อ ${poNumber} ได้รับการอนุมัติโดย ${approverName}`,
        url: `/po/${poId}`,
      })
    )
  }

  // Email notification
  if (channels.email && po?.createdBy?.email) {
    tasks.push(sendPOApprovalEmail(poId, po.createdBy.email))
  }

  // LINE notification
  if (channels.line) {
    const lineUserId = await getUserLineId(creatorId)
    if (lineUserId) {
      tasks.push(sendLineNotificationToUser(lineUserId, 'poApproved', {
        poId,
        poNumber,
        supplierName: po?.supplier?.name,
        approverName,
        eta: po?.eta ? new Date(po.eta).toLocaleDateString('th-TH') : undefined,
      }))
    }
  }

  // Also send LINE to global recipients
  const linePromise = sendLinePOStatusUpdate(poId, 'อนุมัติแล้ว')

  await Promise.allSettled([...tasks, linePromise])
}

/**
 * Send notifications when a PO is rejected
 * Respects user notification preferences
 */
async function notifyPORejected(
  poId: string, 
  poNumber: string, 
  creatorId: string, 
  approverName: string, 
  reason?: string
) {
  const notificationType: NotificationTypeKey = 'poRejected'
  const channels = await getUserEnabledChannels(creatorId, notificationType)
  const tasks: Promise<unknown>[] = []

  const message = reason
    ? `ใบสั่งซื้อ ${poNumber} ไม่ได้รับการอนุมัติโดย ${approverName}: ${reason}`
    : `ใบสั่งซื้อ ${poNumber} ไม่ได้รับการอนุมัติโดย ${approverName}`

  // Web notification
  if (channels.web) {
    tasks.push(
      createNotification({
        userId: creatorId,
        type: 'po_pending',
        title: `PO ${poNumber} ไม่อนุมัติ`,
        message,
        url: `/po/${poId}`,
      })
    )
  }

  // LINE notification
  if (channels.line) {
    const lineUserId = await getUserLineId(creatorId)
    if (lineUserId) {
      tasks.push(sendLineNotificationToUser(lineUserId, 'poRejected', {
        poId,
        poNumber,
        approverName,
        reason,
      }))
    }
  }

  // Also send LINE to global recipients
  const linePromise = sendLinePOStatusUpdate(poId, 'ไม่อนุมัติ')

  await Promise.allSettled([...tasks, linePromise])
}

/**
 * Send notifications when a PO is sent to supplier
 * Respects user notification preferences
 */
async function notifyPOSent(poId: string, poNumber: string, creatorId: string) {
  const notificationType: NotificationTypeKey = 'poSent'
  const channels = await getUserEnabledChannels(creatorId, notificationType)
  const tasks: Promise<unknown>[] = []

  // Get PO details
  const po = await prisma.pO.findUnique({
    where: { id: poId },
    include: { supplier: true },
  })

  // Web notification
  if (channels.web) {
    tasks.push(
      createNotification({
        userId: creatorId,
        type: 'po_pending',
        title: `PO ${poNumber} ส่งแล้ว`,
        message: `ใบสั่งซื้อ ${poNumber} ส่งให้ Supplier แล้ว`,
        url: `/po/${poId}`,
      })
    )
  }

  // LINE notification (individual to creator)
  if (channels.line) {
    const lineUserId = await getUserLineId(creatorId)
    if (lineUserId) {
      tasks.push(sendLineNotificationToUser(lineUserId, 'poSent', {
        poId,
        poNumber,
        supplierName: po?.supplier?.name,
        eta: po?.eta ? new Date(po.eta).toLocaleDateString('th-TH') : undefined,
      }))
    }
  }

  // LINE notification (global recipients)
  tasks.push(
    sendLinePOStatusUpdate(poId, 'ส่งให้ Supplier แล้ว').catch((err) =>
      console.error('Failed to send LINE PO sent to global recipients:', err)
    )
  )

  await Promise.allSettled(tasks)
}

/**
 * Send notifications when a PO is cancelled
 * Respects user notification preferences
 */
async function notifyPOCancelled(poId: string, poNumber: string, creatorId: string) {
  const notificationType: NotificationTypeKey = 'poCancelled'
  const channels = await getUserEnabledChannels(creatorId, notificationType)
  const tasks: Promise<unknown>[] = []

  // Web notification
  if (channels.web) {
    tasks.push(
      createNotification({
        userId: creatorId,
        type: 'po_pending',
        title: `PO ${poNumber} ยกเลิกแล้ว`,
        message: `ใบสั่งซื้อ ${poNumber} ถูกยกเลิกแล้ว`,
        url: `/po/${poId}`,
      })
    )
  }

  // LINE notification (individual to creator)
  if (channels.line) {
    const lineUserId = await getUserLineId(creatorId)
    if (lineUserId) {
      tasks.push(sendLineNotificationToUser(lineUserId, 'poCancelled', {
        poId,
        poNumber,
      }))
    }
  }

  // LINE notification (global recipients)
  tasks.push(
    sendLinePOStatusUpdate(poId, 'ยกเลิกแล้ว').catch((err) =>
      console.error('Failed to send LINE PO cancelled to global recipients:', err)
    )
  )

  await Promise.allSettled(tasks)
}
