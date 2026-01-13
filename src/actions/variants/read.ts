'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import type { ActionResult } from '@/types'

/**
 * Get all variants for a product
 */
export async function getProductVariants(productId: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        productId,
        active: true,
        deletedAt: null,
      },
      include: {
        optionValues: {
          include: {
            optionValue: {
              include: {
                optionType: true,
              },
            },
          },
        },
        stockBalances: {
          include: {
            location: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return { success: true as const, data: variants }
  } catch (error) {
    console.error('Get product variants error:', error)
    return { success: false as const, error: 'ไม่สามารถดึงข้อมูล variants ได้' }
  }
}

/**
 * Get a single variant by ID
 */
export async function getVariantById(variantId: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
        optionValues: {
          include: {
            optionValue: {
              include: {
                optionType: true,
              },
            },
          },
        },
        stockBalances: {
          include: {
            location: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    })

    if (!variant) {
      return { success: false as const, error: 'ไม่พบ variant' }
    }

    return { success: true as const, data: variant }
  } catch (error) {
    console.error('Get variant by ID error:', error)
    return { success: false as const, error: 'ไม่สามารถดึงข้อมูล variant ได้' }
  }
}

/**
 * Get variant stock across all locations
 */
export async function getVariantStock(variantId: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const stockBalances = await prisma.stockBalance.findMany({
      where: { variantId },
      include: {
        location: {
          include: {
            warehouse: true,
          },
        },
      },
    })

    const totalStock = stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)

    return {
      success: true as const,
      data: {
        totalStock,
        locations: stockBalances,
      },
    }
  } catch (error) {
    console.error('Get variant stock error:', error)
    return { success: false as const, error: 'ไม่สามารถดึงข้อมูลสต๊อคได้' }
  }
}
