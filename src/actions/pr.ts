'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { PRStatus } from '@/generated/prisma'
import type { ActionResult, PaginatedResult, PRWithRelations } from '@/types'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { NOTIFICATION_TEMPLATES } from '@/lib/notification-templates'
import { prApprovalRequestEmail } from '@/lib/email'

interface PRLineInput {
  productId: string
  variantId?: string
  qty: number
  note?: string
}

interface CreatePRInput {
  needByDate?: Date
  note?: string
  priority?: string
  lines: PRLineInput[]
}

async function generatePRNumber(): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.docSequence.update({
      where: { docType: 'PR' },
      data: { currentNo: { increment: 1 } },
    })

    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const num = sequence.currentNo.toString().padStart(sequence.padLength, '0')

    return `${sequence.prefix}${year}${month}-${num}`
  })

  return result
}

function serializePR(pr: unknown): PRWithRelations {
  const p = pr as Record<string, unknown>
  const serialized = {
    ...p,
    lines: (p.lines as Array<Record<string, unknown>>)?.map(line => ({
      ...line,
      qty: Number(line.qty),
      product: line.product ? serializeProduct(line.product as Record<string, unknown>) : null,
    })),
  }
  return serialized as unknown as PRWithRelations
}

function serializeProduct(product: Record<string, unknown>) {
  return {
    ...product,
    reorderPoint: product.reorderPoint ? Number(product.reorderPoint) : null,
    minQty: product.minQty ? Number(product.minQty) : null,
    maxQty: product.maxQty ? Number(product.maxQty) : null,
    standardCost: product.standardCost ? Number(product.standardCost) : null,
    lastCost: product.lastCost ? Number(product.lastCost) : null,
  }
}

export async function getPRs(params: {
  page?: number
  limit?: number
  status?: PRStatus
  search?: string
}): Promise<PaginatedResult<PRWithRelations>> {
  const { page = 1, limit = 20, status, search } = params

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { prNumber: { contains: search, mode: 'insensitive' as const } },
        { note: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.pR.findMany({
      where,
      include: {
        requester: {
          select: { id: true, name: true },
        },
        approver: {
          select: { id: true, name: true },
        },
        lines: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            qty: true,
            note: true,
            product: {
              select: { id: true, name: true, sku: true, standardCost: true, reorderPoint: true, hasVariants: true },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
                optionValues: {
                  include: {
                    optionValue: {
                      include: { optionType: true }
                    }
                  }
                }
              }
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pR.count({ where }),
  ])

  return {
    items: items.map(serializePR),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getPR(id: string): Promise<PRWithRelations | null> {
  const pr = await prisma.pR.findUnique({
    where: { id },
    include: {
      requester: {
        select: { id: true, name: true, username: true, role: true },
      },
      approver: {
        select: { id: true, name: true, username: true, role: true },
      },
      lines: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, standardCost: true, reorderPoint: true, minQty: true, maxQty: true, hasVariants: true },
          },
          variant: {
            include: {
              optionValues: {
                include: {
                  optionValue: {
                    include: { optionType: true }
                  }
                }
              }
            }
          },
        },
      },
    },
  })

  return pr ? serializePR(pr) : null
}

export async function createPR(data: CreatePRInput): Promise<ActionResult<PRWithRelations>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!data.lines || data.lines.length === 0) {
    return { success: false, error: 'กรุณาเพิ่มรายการสินค้า' }
  }

  try {
    const prNumber = await generatePRNumber()

    const pr = await prisma.pR.create({
      data: {
        prNumber,
        requesterId: session.id,
        needByDate: data.needByDate,
        note: data.note,
        priority: data.priority || 'NORMAL',
        status: PRStatus.DRAFT,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            qty: line.qty,
            note: line.note,
          })),
        },
      },
      include: {
        requester: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        approver: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        lines: {
          include: {
            product: true,
            variant: {
              include: {
                optionValues: {
                  include: {
                    optionValue: {
                      include: { optionType: true }
                    }
                  }
                }
              }
            },
          },
        },
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'PR',
        refId: pr.id,
        newData: { prNumber },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/pr')
    return { success: true, data: serializePR(pr) }
  } catch (error) {
    console.error('Create PR error:', error)
    return { success: false, error: 'ไม่สามารถสร้าง PR ได้' }
  }
}

export async function submitPR(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const pr = await prisma.pR.findUnique({
      where: { id },
      include: { lines: true, requester: true },
    })

    if (!pr) {
      return { success: false, error: 'ไม่พบ PR' }
    }

    // Allow submit for DRAFT and REJECTED status (can be resubmitted for approval)
    if (pr.status !== PRStatus.DRAFT && pr.status !== PRStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถส่ง PR ที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    if (pr.lines.length === 0) {
      return { success: false, error: 'กรุณาเพิ่มรายการสินค้าก่อนส่ง' }
    }

    await prisma.pR.update({
      where: { id },
      data: { status: PRStatus.SUBMITTED },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'SUBMIT',
        refType: 'PR',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    // Send notifications to approvers (in-app, email, LINE)
    // Run in background to not block the main action
    notifyPRSubmitted(id, pr.prNumber, pr.requester.name).catch((err) =>
      console.error('Failed to send PR submission notifications:', err)
    )

    revalidatePath('/pr')
    revalidatePath(`/pr/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Submit PR error:', error)
    return { success: false, error: 'ไม่สามารถส่ง PR ได้' }
  }
}

export async function approvePR(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const pr = await prisma.pR.findUnique({ where: { id } })

    if (!pr) {
      return { success: false, error: 'ไม่พบ PR' }
    }

    if (pr.status !== PRStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถอนุมัติ PR ที่ไม่ใช่ Submitted ได้' }
    }

    await prisma.pR.update({
      where: { id },
      data: {
        status: PRStatus.APPROVED,
        approverId: session.id,
        approvedAt: new Date(),
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'APPROVE',
        refType: 'PR',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    // Send notification to requester based on their preferences
    notifyPRApproved(id, pr.prNumber, pr.requesterId, session.name).catch((err) =>
      console.error('Failed to send PR approval notifications:', err)
    )

    revalidatePath('/pr')
    revalidatePath(`/pr/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Approve PR error:', error)
    return { success: false, error: 'ไม่สามารถอนุมัติ PR ได้' }
  }
}

export async function rejectPR(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const pr = await prisma.pR.findUnique({ where: { id } })

    if (!pr) {
      return { success: false, error: 'ไม่พบ PR' }
    }

    if (pr.status !== PRStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถปฏิเสธ PR ที่ไม่ใช่ Submitted ได้' }
    }

    await prisma.pR.update({
      where: { id },
      data: {
        status: PRStatus.REJECTED,
        approverId: session.id,
        approvedAt: new Date(),
        rejectedReason: reason,
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'REJECT',
        refType: 'PR',
        refId: id,
        newData: { reason },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    // Send notification to requester based on their preferences
    notifyPRRejected(id, pr.prNumber, pr.requesterId, session.name, reason).catch((err) =>
      console.error('Failed to send PR rejection notifications:', err)
    )

    revalidatePath('/pr')
    revalidatePath(`/pr/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Reject PR error:', error)
    return { success: false, error: 'ไม่สามารถปฏิเสธ PR ได้' }
  }
}

interface UpdatePRLineInput {
  id?: string
  productId: string
  variantId?: string
  qty: number
  note?: string
}

interface UpdatePRInput {
  needByDate?: Date
  note?: string
  priority?: string
  lines: UpdatePRLineInput[]
}

export async function updatePR(id: string, data: UpdatePRInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const pr = await prisma.pR.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!pr) {
      return { success: false, error: 'ไม่พบ PR' }
    }

    // Allow editing for DRAFT and REJECTED status (can be resubmitted for approval)
    if (pr.status !== PRStatus.DRAFT && pr.status !== PRStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถแก้ไข PR ที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    // Delete old lines
    await prisma.pRLine.deleteMany({
      where: { prId: id },
    })

    // Update PR and create new lines
    await prisma.pR.update({
      where: { id },
      data: {
        needByDate: data.needByDate,
        note: data.note,
        priority: data.priority,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            qty: line.qty,
            note: line.note,
          })),
        },
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'PR',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/pr')
    revalidatePath(`/pr/${id}`)
    revalidatePath(`/pr/${id}/edit`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update PR error:', error)
    return { success: false, error: 'ไม่สามารถแก้ไข PR ได้' }
  }
}

// ============================================
// Notification Helpers
// ============================================

/**
 * Send notifications to all approvers when a PR is submitted.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPRSubmitted(prId: string, prNumber: string, requesterName: string) {
  const approvers = await prisma.user.findMany({
    where: { active: true, deletedAt: null, role: { in: ['ADMIN', 'APPROVER'] } },
    select: { id: true },
  })

  const pr = await prisma.pR.findUnique({
    where: { id: prId },
    include: { _count: { select: { lines: true } } },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.prPending({ prId, prNumber, requesterName }, appUrl)

  await dispatchNotification({
    type: 'prPending',
    webType: 'pr_pending',
    title: `PR ใหม่รออนุมัติ: ${prNumber}`,
    message: `${requesterName} ส่งใบขอซื้อ ${prNumber} รออนุมัติ`,
    url: `/pr/${prId}`,
    lineTemplate,
    emailSubject: `[รออนุมัติ] ใบขอซื้อ ${prNumber}`,
    emailHtml: prApprovalRequestEmail({
      prNumber,
      requesterName,
      itemCount: pr?._count.lines || 0,
      url: `${appUrl}/pr/${prId}`,
    }),
    targetUserIds: approvers.map((a) => a.id),
  })
}

/**
 * Send notification when a PR is approved.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPRApproved(prId: string, prNumber: string, requesterId: string, approverName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.prApproved({ prId, prNumber, approverName }, appUrl)

  await dispatchNotification({
    type: 'prApproved',
    webType: 'pr_pending',
    title: `PR ${prNumber} อนุมัติแล้ว`,
    message: `ใบขอซื้อ ${prNumber} ได้รับการอนุมัติโดย ${approverName}`,
    url: `/pr/${prId}`,
    lineTemplate,
    targetUserIds: [requesterId],
  })
}

/**
 * Send notification when a PR is rejected.
 * Uses the unified dispatcher -- single path, always checks preferences.
 */
async function notifyPRRejected(
  prId: string,
  prNumber: string,
  requesterId: string,
  approverName: string,
  reason?: string
) {
  const message = reason
    ? `ใบขอซื้อ ${prNumber} ถูกปฏิเสธโดย ${approverName}: ${reason}`
    : `ใบขอซื้อ ${prNumber} ถูกปฏิเสธโดย ${approverName}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.prRejected({ prId, prNumber, approverName, reason }, appUrl)

  await dispatchNotification({
    type: 'prRejected',
    webType: 'pr_pending',
    title: `PR ${prNumber} ถูกปฏิเสธ`,
    message,
    url: `/pr/${prId}`,
    lineTemplate,
    targetUserIds: [requesterId],
  })
}
