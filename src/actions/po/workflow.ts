'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { POStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'

/**
 * Approve a PO
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

    if (po.status !== POStatus.DRAFT) {
      return { success: false, error: 'ไม่สามารถอนุมัติ PO ที่ไม่ใช่ Draft ได้' }
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

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'sendPO')
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

    revalidatePath('/po')
    revalidatePath(`/po/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'cancelPO')
  }
}
