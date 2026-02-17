'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { POStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { NOTIFICATION_TEMPLATES } from '@/lib/notification-templates'
import { poApprovedEmail } from '@/lib/email'

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
 * Send notifications when a PO is submitted for approval.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPOSubmitted(poId: string, poNumber: string, requesterName: string) {
  const approvers = await prisma.user.findMany({
    where: { active: true, deletedAt: null, role: { in: ['ADMIN', 'APPROVER'] } },
    select: { id: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.poPending({ poId, poNumber }, appUrl)

  await dispatchNotification({
    type: 'poPending',
    webType: 'po_pending',
    title: `PO ใหม่รออนุมัติ: ${poNumber}`,
    message: `${requesterName} ส่งใบสั่งซื้อ ${poNumber} รออนุมัติ`,
    url: `/po/${poId}`,
    lineTemplate,
    targetUserIds: approvers.map((a) => a.id),
  })
}

/**
 * Send notifications when a PO is approved.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPOApproved(poId: string, poNumber: string, creatorId: string, approverName: string) {
  const po = await prisma.pO.findUnique({
    where: { id: poId },
    include: { supplier: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.poApproved({
    poId,
    poNumber,
    supplierName: po?.supplier?.name,
    approverName,
    eta: po?.eta ? new Date(po.eta).toLocaleDateString('th-TH') : undefined,
  }, appUrl)

  await dispatchNotification({
    type: 'poApproved',
    webType: 'po_pending',
    title: `PO ${poNumber} อนุมัติแล้ว`,
    message: `ใบสั่งซื้อ ${poNumber} ได้รับการอนุมัติโดย ${approverName}`,
    url: `/po/${poId}`,
    lineTemplate,
    emailSubject: `[อนุมัติแล้ว] ใบสั่งซื้อ ${poNumber}`,
    emailHtml: po ? poApprovedEmail({ poNumber, supplierName: po.supplier.name, total: Number(po.total) }) : undefined,
    targetUserIds: [creatorId],
  })
}

/**
 * Send notifications when a PO is rejected.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPORejected(
  poId: string,
  poNumber: string,
  creatorId: string,
  approverName: string,
  reason?: string
) {
  const message = reason
    ? `ใบสั่งซื้อ ${poNumber} ไม่ได้รับการอนุมัติโดย ${approverName}: ${reason}`
    : `ใบสั่งซื้อ ${poNumber} ไม่ได้รับการอนุมัติโดย ${approverName}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.poRejected({ poId, poNumber, approverName, reason }, appUrl)

  await dispatchNotification({
    type: 'poRejected',
    webType: 'po_pending',
    title: `PO ${poNumber} ไม่อนุมัติ`,
    message,
    url: `/po/${poId}`,
    lineTemplate,
    targetUserIds: [creatorId],
  })
}

/**
 * Send notifications when a PO is sent to supplier.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPOSent(poId: string, poNumber: string, creatorId: string) {
  const po = await prisma.pO.findUnique({
    where: { id: poId },
    include: { supplier: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.poSent({
    poId,
    poNumber,
    supplierName: po?.supplier?.name,
    eta: po?.eta ? new Date(po.eta).toLocaleDateString('th-TH') : undefined,
  }, appUrl)

  await dispatchNotification({
    type: 'poSent',
    webType: 'po_pending',
    title: `PO ${poNumber} ส่งแล้ว`,
    message: `ใบสั่งซื้อ ${poNumber} ส่งให้ Supplier แล้ว`,
    url: `/po/${poId}`,
    lineTemplate,
    targetUserIds: [creatorId],
  })
}

/**
 * Send notifications when a PO is cancelled.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPOCancelled(poId: string, poNumber: string, creatorId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.poCancelled({ poId, poNumber }, appUrl)

  await dispatchNotification({
    type: 'poCancelled',
    webType: 'po_pending',
    title: `PO ${poNumber} ยกเลิกแล้ว`,
    message: `ใบสั่งซื้อ ${poNumber} ถูกยกเลิกแล้ว`,
    url: `/po/${poId}`,
    lineTemplate,
    targetUserIds: [creatorId],
  })
}
