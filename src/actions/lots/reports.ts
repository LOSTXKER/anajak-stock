'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'

/**
 * Get lots expiring within specified days
 */
export async function getExpiringLots(days: number = 30) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() + days)

    const lots = await prisma.lot.findMany({
      where: {
        expiryDate: {
          lte: cutoffDate,
          gte: new Date(),
        },
        balances: {
          some: {
            qtyOnHand: { gt: 0 },
          },
        },
      },
      include: {
        product: {
          include: { category: true },
        },
        variant: true,
        balances: {
          where: { qtyOnHand: { gt: 0 } },
          include: { location: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    })

    const result = lots.map((lot) => ({
      ...lot,
      qtyReceived: Number(lot.qtyReceived),
      totalQtyOnHand: lot.balances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0),
      daysUntilExpiry: lot.expiryDate
        ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }))

    return { success: true as const, data: result }
  } catch (error) {
    return handleActionError(error, 'getExpiringLots')
  }
}

/**
 * Get already expired lots with remaining stock
 */
export async function getExpiredLots() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const lots = await prisma.lot.findMany({
      where: {
        expiryDate: {
          lt: new Date(),
        },
        balances: {
          some: {
            qtyOnHand: { gt: 0 },
          },
        },
      },
      include: {
        product: {
          include: { category: true },
        },
        variant: true,
        balances: {
          where: { qtyOnHand: { gt: 0 } },
          include: { location: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    })

    const result = lots.map((lot) => ({
      ...lot,
      qtyReceived: Number(lot.qtyReceived),
      totalQtyOnHand: lot.balances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0),
      daysSinceExpiry: lot.expiryDate
        ? Math.ceil((Date.now() - lot.expiryDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))

    return { success: true as const, data: result }
  } catch (error) {
    return handleActionError(error, 'getExpiredLots')
  }
}

/**
 * Get lot statistics summary
 */
export async function getLotStats() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const [totalLots, expiringLots, expiredLots] = await Promise.all([
      prisma.lot.count(),
      prisma.lot.count({
        where: {
          expiryDate: {
            lte: thirtyDaysFromNow,
            gte: now,
          },
          balances: {
            some: { qtyOnHand: { gt: 0 } },
          },
        },
      }),
      prisma.lot.count({
        where: {
          expiryDate: { lt: now },
          balances: {
            some: { qtyOnHand: { gt: 0 } },
          },
        },
      }),
    ])

    return {
      success: true as const,
      data: {
        totalLots,
        expiringLots,
        expiredLots,
      },
    }
  } catch (error) {
    return handleActionError(error, 'getLotStats')
  }
}
