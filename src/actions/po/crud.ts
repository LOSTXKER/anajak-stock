'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { POStatus, VatType } from '@/generated/prisma'
import type { ActionResult, PaginatedResult, POWithRelations } from '@/types'
import type { CreatePOInput } from './schemas'
import { generatePONumber } from './helpers'
import { calculatePOTotals } from './utils'

const userSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  email: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}

/**
 * Get POs with pagination
 */
export async function getPOs(params: {
  page?: number
  limit?: number
  status?: POStatus
  supplierId?: string
  search?: string
}): Promise<PaginatedResult<POWithRelations>> {
  const { page = 1, limit = 20, status, supplierId, search } = params

  const where = {
    ...(status && { status }),
    ...(supplierId && { supplierId }),
    ...(search && {
      OR: [
        { poNumber: { contains: search, mode: 'insensitive' as const } },
        { note: { contains: search, mode: 'insensitive' as const } },
        { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.pO.findMany({
      where,
      include: {
        supplier: true,
        pr: true,
        createdBy: { select: userSelect },
        approvedBy: { select: userSelect },
        lines: {
          include: { product: true },
        },
        grns: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pO.count({ where }),
  ])

  return {
    items: items as unknown as POWithRelations[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Get a single PO by ID
 */
export async function getPO(id: string): Promise<POWithRelations | null> {
  const po = await prisma.pO.findUnique({
    where: { id },
    include: {
      supplier: true,
      pr: true,
      createdBy: { select: userSelect },
      approvedBy: { select: userSelect },
      lines: {
        include: {
          product: true,
          grnLines: true,
        },
      },
      grns: {
        include: { lines: true },
      },
      timelines: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return po as unknown as POWithRelations | null
}

/**
 * Create a new PO
 */
export async function createPO(data: CreatePOInput): Promise<ActionResult<POWithRelations>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!data.lines || data.lines.length === 0) {
    return { success: false, error: 'กรุณาเพิ่มรายการสินค้า' }
  }

  try {
    const poNumber = await generatePONumber()
    const vatType = data.vatType || VatType.NO_VAT
    const vatRate = data.vatRate || 0
    const { subtotal, vatAmount, total } = calculatePOTotals(data.lines, vatType, vatRate)

    const po = await prisma.pO.create({
      data: {
        poNumber,
        supplierId: data.supplierId,
        prId: data.prId,
        vatType,
        vatRate,
        subtotal,
        vatAmount,
        total,
        eta: data.eta,
        terms: data.terms,
        note: data.note,
        status: POStatus.DRAFT,
        createdById: session.id,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
            unitPrice: line.unitPrice,
            note: line.note,
          })),
        },
        timelines: {
          create: {
            action: 'สร้าง PO',
            note: `สร้างโดย ${session.name}`,
          },
        },
      },
      include: {
        supplier: true,
        pr: true,
        createdBy: { select: userSelect },
        approvedBy: { select: userSelect },
        lines: {
          include: { product: true },
        },
      },
    })

    // Update PR status if linked
    if (data.prId) {
      await prisma.pR.update({
        where: { id: data.prId },
        data: { status: 'CONVERTED' },
      })
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'PO',
        refId: po.id,
        newData: { poNumber },
      },
    })

    revalidatePath('/po')
    revalidatePath('/pr')
    return { success: true, data: po as unknown as POWithRelations }
  } catch (error) {
    return handleActionError(error, 'createPO')
  }
}
