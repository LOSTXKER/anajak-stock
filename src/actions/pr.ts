'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { PRStatus } from '@/generated/prisma'
import type { ActionResult, PaginatedResult, PRWithRelations } from '@/types'

interface PRLineInput {
  productId: string
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
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        approver: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
        },
        lines: {
          include: {
            product: true,
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
        select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
      },
      approver: {
        select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true },
      },
      lines: {
        include: {
          product: true,
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
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'PR',
        refId: pr.id,
        newData: { prNumber },
      },
    })

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
      include: { lines: true },
    })

    if (!pr) {
      return { success: false, error: 'ไม่พบ PR' }
    }

    if (pr.status !== PRStatus.DRAFT) {
      return { success: false, error: 'ไม่สามารถส่ง PR ที่ไม่ใช่ Draft ได้' }
    }

    if (pr.lines.length === 0) {
      return { success: false, error: 'กรุณาเพิ่มรายการสินค้าก่อนส่ง' }
    }

    await prisma.pR.update({
      where: { id },
      data: { status: PRStatus.SUBMITTED },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'SUBMIT',
        refType: 'PR',
        refId: id,
      },
    })

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

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'APPROVE',
        refType: 'PR',
        refId: id,
      },
    })

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

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'REJECT',
        refType: 'PR',
        refId: id,
        newData: { reason },
      },
    })

    revalidatePath('/pr')
    revalidatePath(`/pr/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Reject PR error:', error)
    return { success: false, error: 'ไม่สามารถปฏิเสธ PR ได้' }
  }
}
