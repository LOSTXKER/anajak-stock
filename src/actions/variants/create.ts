'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types'
import {
  CreateProductWithVariantsSchema,
  CreateProductWithInlineVariantsSchema,
  type CreateProductWithVariantsInput,
  type CreateProductWithInlineVariantsInput,
} from './schemas'

/**
 * Create product with pre-defined variants
 */
export async function createProductWithVariants(
  input: CreateProductWithVariantsInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = CreateProductWithVariantsSchema.parse(input)

    // Check for duplicate SKU
    const existingProduct = await prisma.product.findUnique({
      where: { sku: validated.sku },
    })
    if (existingProduct) {
      return { success: false, error: 'SKU สินค้าหลักซ้ำ' }
    }

    // Check for duplicate variant SKUs
    const variantSkus = validated.variants.map(v => v.sku)
    const existingVariants = await prisma.productVariant.findMany({
      where: { sku: { in: variantSkus } },
    })
    if (existingVariants.length > 0) {
      return { success: false, error: `SKU variant ซ้ำ: ${existingVariants.map(v => v.sku).join(', ')}` }
    }

    // Create product with variants in a transaction
    const product = await prisma.$transaction(async (tx) => {
      // Create parent product
      const newProduct = await tx.product.create({
        data: {
          sku: validated.sku,
          name: validated.name,
          description: validated.description,
          categoryId: validated.categoryId || null,
          unitId: validated.unitId || null,
          reorderPoint: validated.reorderPoint,
          minQty: validated.minQty,
          maxQty: validated.maxQty,
          standardCost: validated.standardCost,
          hasVariants: true,
        },
      })

      // Create variants
      for (const variant of validated.variants) {
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: newProduct.id,
            sku: variant.sku,
            barcode: variant.barcode || null,
            name: variant.name || null,
            costPrice: variant.costPrice,
            sellingPrice: variant.sellingPrice,
            reorderPoint: variant.reorderPoint,
            minQty: variant.minQty,
            maxQty: variant.maxQty,
            lowStockAlert: variant.lowStockAlert,
          },
        })

        // Create variant option values
        if (variant.optionValueIds.length > 0) {
          await tx.variantOptionValue.createMany({
            data: variant.optionValueIds.map(optionValueId => ({
              variantId: createdVariant.id,
              optionValueId,
            })),
          })
        }
      }

      return newProduct
    }, {
      timeout: 30000, // 30 seconds - สร้างสินค้าพร้อม variants หลายตัวอาจใช้เวลานาน
      maxWait: 10000,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'PRODUCT',
        refId: product.id,
        newData: { ...validated, hasVariants: true },
      },
    })

    revalidatePath('/products')

    return { success: true, data: { id: product.id } }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return handleActionError(error, 'createProductWithVariants')
  }
}

/**
 * Create product with inline variants (Shopee style)
 * This will create OptionTypes and OptionValues on the fly if they don't exist
 */
export async function createProductWithInlineVariants(
  input: CreateProductWithInlineVariantsInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = CreateProductWithInlineVariantsSchema.parse(input)

    // Check for duplicate product SKU
    const existingProduct = await prisma.product.findUnique({
      where: { sku: validated.sku },
    })
    if (existingProduct) {
      return { success: false, error: 'SKU สินค้าหลักซ้ำ' }
    }

    // Check for duplicate variant SKUs
    const variantSkus = validated.variants.map(v => v.sku)
    const existingVariants = await prisma.productVariant.findMany({
      where: { sku: { in: variantSkus } },
    })
    if (existingVariants.length > 0) {
      return { success: false, error: `SKU variant ซ้ำ: ${existingVariants.map(v => v.sku).join(', ')}` }
    }

    // Create product with variants in a transaction
    const product = await prisma.$transaction(async (tx) => {
      // Step 1: Create or get OptionTypes and OptionValues
      const optionTypeMap: Record<string, string> = {} // name -> id
      const optionValueMap: Record<string, Record<string, string>> = {} // typeName -> { value -> id }

      for (const group of validated.optionGroups) {
        // Find or create OptionType
        let optionType = await tx.optionType.findFirst({
          where: { name: { equals: group.name, mode: 'insensitive' } },
        })
        
        if (!optionType) {
          optionType = await tx.optionType.create({
            data: { name: group.name },
          })
        }

        optionTypeMap[group.name] = optionType.id
        optionValueMap[group.name] = {}

        // Find or create OptionValues
        for (const value of group.values) {
          let optionValue = await tx.optionValue.findFirst({
            where: { 
              optionTypeId: optionType.id,
              value: { equals: value, mode: 'insensitive' },
            },
          })

          if (!optionValue) {
            optionValue = await tx.optionValue.create({
              data: {
                optionTypeId: optionType.id,
                value: value,
              },
            })
          }

          optionValueMap[group.name][value] = optionValue.id
        }
      }

      // Step 2: Create parent product
      const newProduct = await tx.product.create({
        data: {
          sku: validated.sku,
          name: validated.name,
          description: validated.description,
          categoryId: validated.categoryId || null,
          unitId: validated.unitId || null,
          reorderPoint: validated.reorderPoint,
          minQty: validated.minQty,
          maxQty: validated.maxQty,
          standardCost: validated.standardCost,
          hasVariants: true,
        },
      })

      // Step 3: Create variants with their option values
      for (const variant of validated.variants) {
        // Generate variant name from options
        const variantName = variant.options.map(o => o.value).join(', ')

        const createdVariant = await tx.productVariant.create({
          data: {
            productId: newProduct.id,
            sku: variant.sku,
            barcode: variant.barcode || null,
            name: variantName,
            costPrice: variant.costPrice,
            sellingPrice: variant.sellingPrice,
            reorderPoint: variant.reorderPoint,
            minQty: variant.minQty,
            maxQty: variant.maxQty,
            lowStockAlert: variant.lowStockAlert,
          },
        })

        // Create ProductVariantOptionValue entries
        for (const opt of variant.options) {
          const optionValueId = optionValueMap[opt.groupName]?.[opt.value]

          if (optionValueId) {
            await tx.variantOptionValue.create({
              data: {
                variantId: createdVariant.id,
                optionValueId: optionValueId,
              },
            })
          }
        }
      }

      // Step 4: Create initial stock if provided
      if (validated.initialStock && validated.initialStock.items.length > 0) {
        const { locationId, note, items } = validated.initialStock

        // Get created variants to map SKU -> ID
        const createdVariants = await tx.productVariant.findMany({
          where: { productId: newProduct.id },
          select: { id: true, sku: true, costPrice: true },
        })

        const skuToVariant = new Map(createdVariants.map(v => [v.sku, v]))

        // Generate movement number
        const today = new Date()
        const prefix = `RCV${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
        const lastMovement = await tx.stockMovement.findFirst({
          where: { docNumber: { startsWith: prefix } },
          orderBy: { docNumber: 'desc' },
        })
        const seq = lastMovement
          ? parseInt(lastMovement.docNumber.slice(-4)) + 1
          : 1
        const docNumber = `${prefix}${String(seq).padStart(4, '0')}`

        // Create RECEIVE movement with lines
        const movementLines = items
          .filter(item => skuToVariant.has(item.sku))
          .map(item => {
            const variant = skuToVariant.get(item.sku)!
            return {
              productId: newProduct.id,
              variantId: variant.id,
              toLocationId: locationId,
              qty: item.qty,
              unitCost: Number(variant.costPrice) || 0,
            }
          })

        if (movementLines.length > 0) {
          await tx.stockMovement.create({
            data: {
              docNumber,
              type: 'RECEIVE',
              status: 'POSTED',
              createdById: session.id,
              approvedById: session.id,
              postedAt: new Date(),
              note: note || 'สต๊อคเริ่มต้นจากการสร้างสินค้า',
              lines: {
                create: movementLines,
              },
            },
          })

          // Update stock balances for each variant
          for (const line of movementLines) {
            await tx.stockBalance.upsert({
              where: {
                productId_variantId_locationId: {
                  productId: newProduct.id,
                  variantId: line.variantId || '',
                  locationId,
                },
              },
              create: {
                productId: newProduct.id,
                variantId: line.variantId,
                locationId,
                qtyOnHand: line.qty,
              },
              update: {
                qtyOnHand: { increment: line.qty },
              },
            })
          }
        }
      }

      return newProduct
    }, {
      timeout: 30000, // 30 seconds - สร้างสินค้าพร้อม variants หลายตัวอาจใช้เวลานาน
      maxWait: 10000,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'PRODUCT',
        refId: product.id,
        newData: { ...validated, hasVariants: true },
      },
    })

    revalidatePath('/products')
    revalidatePath('/movements')
    revalidatePath('/stock')

    return { success: true, data: { id: product.id } }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return handleActionError(error, 'createProductWithInlineVariants')
  }
}
