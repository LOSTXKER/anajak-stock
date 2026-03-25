'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { DocStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import type { UpdateMovementInput } from './shared'

export async function updateMovement(id: string, data: UpdateMovementInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.DRAFT && movement.status !== DocStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถแก้ไขรายการที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    await prisma.movementLine.deleteMany({
      where: { movementId: id },
    })

    await prisma.stockMovement.update({
      where: { id },
      data: {
        note: data.note,
        reason: data.reason,
        projectCode: data.projectCode,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId || null,
            fromLocationId: line.fromLocationId || null,
            toLocationId: line.toLocationId || null,
            qty: line.qty,
            unitCost: line.unitCost || 0,
            note: line.note,
            orderRef: line.orderRef || null,
          })),
        },
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'MOVEMENT',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    revalidatePath(`/movements/${id}/edit`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update movement error:', error)
    return { success: false, error: 'ไม่สามารถแก้ไขรายการได้' }
  }
}

export async function cancelMovement(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status === DocStatus.POSTED) {
      return { success: false, error: 'ไม่สามารถยกเลิกรายการที่ Post แล้วได้' }
    }

    if (movement.status === DocStatus.CANCELLED) {
      return { success: false, error: 'รายการนี้ถูกยกเลิกแล้ว' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: {
        status: DocStatus.CANCELLED,
        note: reason ? `${movement.note || ''}\n[ยกเลิก] ${reason}` : movement.note,
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CANCEL',
        refType: 'MOVEMENT',
        refId: id,
        newData: { reason },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Cancel movement error:', error)
    return { success: false, error: 'ไม่สามารถยกเลิกรายการได้' }
  }
}
