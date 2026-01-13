'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CreateLotSchema, UpdateLotSchema, type CreateLotInput, type UpdateLotInput } from './schemas'

/**
 * Get lots with optional filters
 */
export async function getLots(filters?: {
  productId?: string
  search?: string
  expiringWithinDays?: number
  limit?: number
}) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (filters?.productId) {
      where.productId = filters.productId
    }

    if (filters?.search) {
      where.OR = [
        { lotNumber: { contains: filters.search, mode: 'insensitive' } },
        { product: { sku: { contains: filters.search, mode: 'insensitive' } } },
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    if (filters?.expiringWithinDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() + filters.expiringWithinDays)
      where.expiryDate = {
        lte: cutoffDate,
        gte: new Date(),
      }
    }

    const lots = await prisma.lot.findMany({
      where,
      include: {
        product: {
          include: { category: true },
        },
        variant: true,
        balances: {
          include: { location: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
      take: filters?.limit || 100,
    })

    // Calculate total qty for each lot
    const result = lots.map((lot) => ({
      ...lot,
      qtyReceived: Number(lot.qtyReceived),
      totalQtyOnHand: lot.balances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0),
      balances: lot.balances.map((b) => ({
        ...b,
        qtyOnHand: Number(b.qtyOnHand),
      })),
    }))

    return { success: true as const, data: result }
  } catch (error) {
    return handleActionError(error, 'getLots')
  }
}

/**
 * Get a single lot by ID
 */
export async function getLot(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
        product: {
          include: { category: true },
        },
        variant: true,
        balances: {
          include: {
            location: {
              include: { warehouse: true },
            },
          },
        },
        movementLines: {
          include: {
            movementLine: {
              include: {
                movement: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!lot) {
      return { success: false as const, error: 'ไม่พบ Lot' }
    }

    return {
      success: true as const,
      data: {
        ...lot,
        qtyReceived: Number(lot.qtyReceived),
        totalQtyOnHand: lot.balances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0),
      },
    }
  } catch (error) {
    return handleActionError(error, 'getLot')
  }
}

/**
 * Create a new lot
 */
export async function createLot(input: CreateLotInput) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const validated = CreateLotSchema.parse(input)

    // Check for duplicate lot number
    const existingLot = await prisma.lot.findFirst({
      where: {
        lotNumber: validated.lotNumber,
        productId: validated.productId,
      },
    })

    if (existingLot) {
      return { success: false as const, error: 'หมายเลข Lot นี้มีอยู่แล้วสำหรับสินค้านี้' }
    }

    const lot = await prisma.lot.create({
      data: {
        lotNumber: validated.lotNumber,
        productId: validated.productId,
        variantId: validated.variantId || null,
        expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
        manufacturedDate: validated.manufacturedDate ? new Date(validated.manufacturedDate) : null,
        qtyReceived: validated.qtyReceived,
        note: validated.note,
      },
    })

    revalidatePath('/lots')
    return { success: true as const, data: lot }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0].message }
    }
    return handleActionError(error, 'createLot')
  }
}

/**
 * Update a lot
 */
export async function updateLot(id: string, input: UpdateLotInput) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const validated = UpdateLotSchema.parse(input)

    const lot = await prisma.lot.update({
      where: { id },
      data: {
        expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
        manufacturedDate: validated.manufacturedDate ? new Date(validated.manufacturedDate) : null,
        note: validated.note,
      },
    })

    revalidatePath('/lots')
    revalidatePath(`/lots/${id}`)
    return { success: true as const, data: lot }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0].message }
    }
    return handleActionError(error, 'updateLot')
  }
}

/**
 * Get lots by product ID
 */
export async function getLotsByProduct(productId: string, variantId?: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      productId,
      balances: {
        some: {
          qtyOnHand: { gt: 0 },
        },
      },
    }

    if (variantId) {
      where.variantId = variantId
    }

    const lots = await prisma.lot.findMany({
      where,
      include: {
        balances: {
          where: { qtyOnHand: { gt: 0 } },
          include: { location: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    })

    return {
      success: true as const,
      data: lots.map((lot) => ({
        ...lot,
        qtyReceived: Number(lot.qtyReceived),
        totalQtyOnHand: lot.balances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0),
      })),
    }
  } catch (error) {
    return handleActionError(error, 'getLotsByProduct')
  }
}
