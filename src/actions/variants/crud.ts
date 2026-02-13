'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types'
import {
  VariantInputSchema,
  UpdateVariantSchema,
  type VariantInput,
  type UpdateVariantInput,
} from './schemas'

/**
 * Add a new variant to an existing product
 */
export async function addVariant(
  productId: string,
  input: VariantInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = VariantInputSchema.parse(input)

    // Check product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })
    if (!product) {
      return { success: false, error: 'ไม่พบสินค้า' }
    }

    // Check for duplicate SKU
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: validated.sku },
    })
    if (existingSku) {
      return { success: false, error: 'SKU ซ้ำ' }
    }

    // Create variant in transaction
    const variant = await prisma.$transaction(async (tx) => {
      const createdVariant = await tx.productVariant.create({
        data: {
          productId,
          sku: validated.sku,
          barcode: validated.barcode || null,
          name: validated.name || null,
          stockType: validated.stockType,
          costPrice: validated.costPrice,
          sellingPrice: validated.sellingPrice,
          reorderPoint: validated.reorderPoint,
          minQty: validated.minQty,
          maxQty: validated.maxQty,
          lowStockAlert: validated.lowStockAlert,
        },
      })

      // Create variant option values
      if (validated.optionValueIds.length > 0) {
        await tx.variantOptionValue.createMany({
          data: validated.optionValueIds.map(optionValueId => ({
            variantId: createdVariant.id,
            optionValueId,
          })),
        })
      }

      // Update product to hasVariants if not already
      if (!product.hasVariants) {
        await tx.product.update({
          where: { id: productId },
          data: { hasVariants: true },
        })
      }

      return createdVariant
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'VARIANT',
        refId: variant.id,
        newData: validated,
      },
    })

    revalidatePath(`/products/${productId}`)

    return { success: true, data: { id: variant.id } }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return handleActionError(error, 'addVariant')
  }
}

/**
 * Update an existing variant
 */
export async function updateVariant(
  variantId: string,
  input: UpdateVariantInput
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = UpdateVariantSchema.parse(input)

    const existing = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })
    if (!existing) {
      return { success: false, error: 'ไม่พบ variant' }
    }

    // Check for duplicate SKU if updating
    if (validated.sku && validated.sku !== existing.sku) {
      const existingSku = await prisma.productVariant.findUnique({
        where: { sku: validated.sku },
      })
      if (existingSku) {
        return { success: false, error: 'SKU ซ้ำ' }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update variant
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          sku: validated.sku,
          barcode: validated.barcode,
          name: validated.name,
          stockType: validated.stockType,
          costPrice: validated.costPrice,
          sellingPrice: validated.sellingPrice,
          reorderPoint: validated.reorderPoint,
          minQty: validated.minQty,
          maxQty: validated.maxQty,
          lowStockAlert: validated.lowStockAlert,
        },
      })

      // Update option values if provided
      if (validated.optionValueIds) {
        // Delete existing option values
        await tx.variantOptionValue.deleteMany({
          where: { variantId },
        })

        // Create new option values
        if (validated.optionValueIds.length > 0) {
          await tx.variantOptionValue.createMany({
            data: validated.optionValueIds.map(optionValueId => ({
              variantId,
              optionValueId,
            })),
          })
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'VARIANT',
        refId: variantId,
        oldData: existing,
        newData: validated,
      },
    })

    revalidatePath(`/products/${existing.productId}`)

    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'updateVariant')
  }
}

/**
 * Delete a variant (soft delete)
 */
export async function deleteVariant(variantId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const existing = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        stockBalances: true,
        movementLines: true,
      },
    })
    if (!existing) {
      return { success: false, error: 'ไม่พบ variant' }
    }

    // Check if variant is in use
    if (existing.stockBalances.length > 0 || existing.movementLines.length > 0) {
      return { success: false, error: 'ไม่สามารถลบ variant ที่มีการเคลื่อนไหวหรือสต๊อคได้' }
    }

    // Soft delete
    await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'VARIANT',
        refId: variantId,
        oldData: existing,
      },
    })

    revalidatePath(`/products/${existing.productId}`)

    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'deleteVariant')
  }
}

/**
 * Merge a source variant into a target variant, then soft-delete the source.
 * Transfers all movementLines and stockBalances from source → target.
 */
export async function mergeAndDeleteVariant(
  sourceVariantId: string,
  targetVariantId: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const [source, target] = await Promise.all([
      prisma.productVariant.findUnique({
        where: { id: sourceVariantId },
        include: {
          stockBalances: true,
          movementLines: true,
        },
      }),
      prisma.productVariant.findUnique({
        where: { id: targetVariantId },
      }),
    ])

    if (!source) {
      return { success: false, error: 'ไม่พบ variant ต้นทาง' }
    }
    if (!target) {
      return { success: false, error: 'ไม่พบ variant ปลายทาง' }
    }
    if (source.productId !== target.productId) {
      return { success: false, error: 'variant ทั้งสองต้องอยู่ในสินค้าเดียวกัน' }
    }
    if (sourceVariantId === targetVariantId) {
      return { success: false, error: 'ไม่สามารถ merge variant เดียวกันได้' }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Transfer all movementLines from source → target
      if (source.movementLines.length > 0) {
        await tx.movementLine.updateMany({
          where: { variantId: sourceVariantId },
          data: { variantId: targetVariantId },
        })
      }

      // 2. Transfer stockBalances from source → target
      for (const srcBalance of source.stockBalances) {
        // Try to find existing balance for target at same location
        const existingTargetBalance = await tx.stockBalance.findUnique({
          where: {
            productId_variantId_locationId: {
              productId: target.productId,
              variantId: targetVariantId,
              locationId: srcBalance.locationId,
            },
          },
        })

        if (existingTargetBalance) {
          // Merge: add source qty to target
          await tx.stockBalance.update({
            where: { id: existingTargetBalance.id },
            data: {
              qtyOnHand: { increment: srcBalance.qtyOnHand },
            },
          })
        } else {
          // Move: update the balance to point to target variant
          await tx.stockBalance.update({
            where: { id: srcBalance.id },
            data: { variantId: targetVariantId },
          })
          // Skip deletion for this balance since we moved it
          continue
        }

        // Delete the source balance (already merged into target)
        await tx.stockBalance.delete({
          where: { id: srcBalance.id },
        })
      }

      // 3. Soft-delete the source variant
      await tx.productVariant.update({
        where: { id: sourceVariantId },
        data: {
          active: false,
          deletedAt: new Date(),
        },
      })
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'VARIANT',
        refId: sourceVariantId,
        oldData: {
          action: 'MERGE_AND_DELETE',
          sourceVariantId,
          sourceSku: source.sku,
          targetVariantId,
          targetSku: target.sku,
          movedMovementLines: source.movementLines.length,
          movedStockBalances: source.stockBalances.length,
        },
      },
    })

    revalidatePath(`/products/${source.productId}`)
    revalidatePath('/products')
    revalidatePath('/stock')

    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'mergeAndDeleteVariant')
  }
}

/**
 * Bulk update stockType for multiple variants
 */
export async function bulkUpdateVariantStockType(
  variantIds: string[],
  stockType: 'STOCKED' | 'MADE_TO_ORDER' | 'DROP_SHIP'
): Promise<ActionResult<{ updated: number }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    // Update all variants in a single query
    const result = await prisma.productVariant.updateMany({
      where: {
        id: { in: variantIds },
        active: true,
        deletedAt: null,
      },
      data: { stockType },
    })

    // Get affected product IDs for revalidation
    const affectedVariants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { productId: true },
    })

    const productIds = [...new Set(affectedVariants.map(v => v.productId))]
    for (const productId of productIds) {
      revalidatePath(`/products/${productId}`)
    }
    revalidatePath('/products')

    return { success: true, data: { updated: result.count } }
  } catch (error) {
    return handleActionError(error, 'bulkUpdateVariantStockType')
  }
}

/**
 * Bulk update stockType for multiple products (without variants)
 */
export async function bulkUpdateProductStockType(
  productIds: string[],
  stockType: 'STOCKED' | 'MADE_TO_ORDER' | 'DROP_SHIP'
): Promise<ActionResult<{ updated: number }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    // Update all products in a single query
    const result = await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        active: true,
        deletedAt: null,
      },
      data: { stockType },
    })

    for (const productId of productIds) {
      revalidatePath(`/products/${productId}`)
    }
    revalidatePath('/products')

    return { success: true, data: { updated: result.count } }
  } catch (error) {
    return handleActionError(error, 'bulkUpdateProductStockType')
  }
}
