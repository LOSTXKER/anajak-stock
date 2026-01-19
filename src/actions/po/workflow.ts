'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { POStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import { createNotification, sendPOApprovalNotification } from '@/actions/notifications'
import { sendLinePOStatusUpdate } from '@/actions/line-notifications'

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

    // Send LINE notification for PO status update
    sendLinePOStatusUpdate(id, 'ส่งให้ Supplier แล้ว').catch((err) =>
      console.error('Failed to send PO sent notification:', err)
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

    // Send notification to PO creator
    createNotification({
      userId: po.createdById,
      type: 'po_pending',
      title: `PO ${po.poNumber} ไม่อนุมัติ`,
      message: reason
        ? `ใบสั่งซื้อ ${po.poNumber} ไม่ได้รับการอนุมัติโดย ${session.name}: ${reason}`
        : `ใบสั่งซื้อ ${po.poNumber} ไม่ได้รับการอนุมัติโดย ${session.name}`,
      url: `/po/${id}`,
    }).catch((err) => console.error('Failed to create rejection notification:', err))

    // Send LINE notification
    sendLinePOStatusUpdate(id, 'ไม่อนุมัติ').catch((err) =>
      console.error('Failed to send PO rejection notification:', err)
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

    // Send LINE notification for PO cancellation
    sendLinePOStatusUpdate(id, 'ยกเลิกแล้ว').catch((err) =>
      console.error('Failed to send PO cancellation notification:', err)
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
 * Sends via in-app notification and LINE to all approvers
 */
async function notifyPOSubmitted(poId: string, poNumber: string, requesterName: string) {
  // Get all approvers (ADMIN and APPROVER roles)
  const approvers = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'APPROVER'] },
    },
    select: { id: true },
  })

  // Create in-app notifications for all approvers
  const notificationPromises = approvers.map((approver) =>
    createNotification({
      userId: approver.id,
      type: 'po_pending',
      title: `PO ใหม่รออนุมัติ: ${poNumber}`,
      message: `${requesterName} ส่งใบสั่งซื้อ ${poNumber} รออนุมัติ`,
      url: `/po/${poId}`,
    })
  )

  // Send LINE notification
  const linePromise = sendLinePOStatusUpdate(poId, 'รออนุมัติ')

  // Execute all in parallel
  await Promise.allSettled([...notificationPromises, linePromise])
}

/**
 * Send notifications when a PO is approved
 * Sends via in-app notification, email, and LINE
 */
async function notifyPOApproved(poId: string, poNumber: string, creatorId: string, approverName: string) {
  // Create in-app notification for PO creator
  const inAppPromise = createNotification({
    userId: creatorId,
    type: 'po_pending',
    title: `PO ${poNumber} อนุมัติแล้ว`,
    message: `ใบสั่งซื้อ ${poNumber} ได้รับการอนุมัติโดย ${approverName}`,
    url: `/po/${poId}`,
  })

  // Send email to PO creator
  const emailPromise = sendPOApprovalNotification(poId)

  // Send LINE notification
  const linePromise = sendLinePOStatusUpdate(poId, 'อนุมัติแล้ว')

  // Execute all in parallel
  await Promise.allSettled([inAppPromise, emailPromise, linePromise])
}
