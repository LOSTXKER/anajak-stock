'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { DocStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import type { BatchResult, BatchResultItem } from '@/types'
import { postMovement } from './workflow'

const MAX_BATCH_SIZE = 50

export async function batchApproveMovements(ids: string[]): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการอนุมัติ' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  try {
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: ids } },
      select: { id: true, docNumber: true, status: true },
    })

    const results: BatchResultItem[] = []
    let succeeded = 0
    let failed = 0

    for (const movement of movements) {
      if (movement.status !== DocStatus.SUBMITTED) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: `สถานะไม่ถูกต้อง (${movement.status}) ต้องเป็น SUBMITTED`,
        })
        failed++
        continue
      }

      try {
        await prisma.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: DocStatus.APPROVED,
            approvedById: session.id,
          },
        })

        prisma.auditLog.create({
          data: {
            actorId: session.id,
            action: 'BATCH_APPROVE',
            refType: 'MOVEMENT',
            refId: movement.id,
          },
        }).catch((err) => console.error('Failed to create audit log:', err))

        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: true,
        })
        succeeded++
      } catch (err) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        })
        failed++
      }
    }

    const foundIds = new Set(movements.map(m => m.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({
          id,
          docNumber: '-',
          success: false,
          error: 'ไม่พบรายการ',
        })
        failed++
      }
    }

    revalidatePath('/movements')
    
    return {
      success: true,
      data: {
        total: ids.length,
        succeeded,
        failed,
        results,
      },
    }
  } catch (error) {
    console.error('Batch approve error:', error)
    return { success: false, error: 'ไม่สามารถอนุมัติรายการได้' }
  }
}

export async function batchRejectMovements(ids: string[], reason?: string): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการปฏิเสธ' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  try {
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: ids } },
      select: { id: true, docNumber: true, status: true, note: true },
    })

    const results: BatchResultItem[] = []
    let succeeded = 0
    let failed = 0

    for (const movement of movements) {
      if (movement.status !== DocStatus.SUBMITTED) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: `สถานะไม่ถูกต้อง (${movement.status}) ต้องเป็น SUBMITTED`,
        })
        failed++
        continue
      }

      try {
        await prisma.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: DocStatus.REJECTED,
            note: reason ? `${movement.note || ''}\n[ปฏิเสธ] ${reason}` : movement.note,
          },
        })

        prisma.auditLog.create({
          data: {
            actorId: session.id,
            action: 'BATCH_REJECT',
            refType: 'MOVEMENT',
            refId: movement.id,
            newData: { reason },
          },
        }).catch((err) => console.error('Failed to create audit log:', err))

        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: true,
        })
        succeeded++
      } catch (err) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        })
        failed++
      }
    }

    const foundIds = new Set(movements.map(m => m.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({
          id,
          docNumber: '-',
          success: false,
          error: 'ไม่พบรายการ',
        })
        failed++
      }
    }

    revalidatePath('/movements')
    
    return {
      success: true,
      data: {
        total: ids.length,
        succeeded,
        failed,
        results,
      },
    }
  } catch (error) {
    console.error('Batch reject error:', error)
    return { success: false, error: 'ไม่สามารถปฏิเสธรายการได้' }
  }
}

export async function batchPostMovements(ids: string[]): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการ Post' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  const results: BatchResultItem[] = []
  let succeeded = 0
  let failed = 0

  for (const id of ids) {
    const result = await postMovement(id)
    
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      select: { docNumber: true },
    })

    if (result.success) {
      results.push({
        id,
        docNumber: movement?.docNumber || '-',
        success: true,
      })
      succeeded++
    } else {
      results.push({
        id,
        docNumber: movement?.docNumber || '-',
        success: false,
        error: result.error,
      })
      failed++
    }
  }

  revalidatePath('/movements')
  revalidatePath('/stock')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: {
      total: ids.length,
      succeeded,
      failed,
      results,
    },
  }
}

export async function batchCancelMovements(ids: string[], reason?: string): Promise<ActionResult<BatchResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (ids.length === 0) {
    return { success: false, error: 'กรุณาเลือกรายการที่ต้องการยกเลิก' }
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return { success: false, error: `สามารถดำเนินการได้ไม่เกิน ${MAX_BATCH_SIZE} รายการต่อครั้ง` }
  }

  const CANCELLABLE_STATUSES: DocStatus[] = [DocStatus.DRAFT, DocStatus.SUBMITTED, DocStatus.APPROVED]

  try {
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: ids } },
      select: { id: true, docNumber: true, status: true, note: true },
    })

    const results: BatchResultItem[] = []
    let succeeded = 0
    let failed = 0

    for (const movement of movements) {
      if (!CANCELLABLE_STATUSES.includes(movement.status)) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: `ไม่สามารถยกเลิกรายการที่มีสถานะ ${movement.status} ได้`,
        })
        failed++
        continue
      }

      try {
        await prisma.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: DocStatus.CANCELLED,
            note: reason ? `${movement.note || ''}\n[ยกเลิก] ${reason}` : movement.note,
          },
        })

        prisma.auditLog.create({
          data: {
            actorId: session.id,
            action: 'BATCH_CANCEL',
            refType: 'MOVEMENT',
            refId: movement.id,
            newData: { reason },
          },
        }).catch((err) => console.error('Failed to create audit log:', err))

        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: true,
        })
        succeeded++
      } catch (err) {
        results.push({
          id: movement.id,
          docNumber: movement.docNumber,
          success: false,
          error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        })
        failed++
      }
    }

    const foundIds = new Set(movements.map(m => m.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({
          id,
          docNumber: '-',
          success: false,
          error: 'ไม่พบรายการ',
        })
        failed++
      }
    }

    revalidatePath('/movements')
    
    return {
      success: true,
      data: {
        total: ids.length,
        succeeded,
        failed,
        results,
      },
    }
  } catch (error) {
    console.error('Batch cancel error:', error)
    return { success: false, error: 'ไม่สามารถยกเลิกรายการได้' }
  }
}
