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

      // Create all variants in batch
      await tx.productVariant.createMany({
        data: validated.variants.map(variant => ({
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
        })),
      })

      // Fetch created variants to get their IDs
      const createdVariants = await tx.productVariant.findMany({
        where: { productId: newProduct.id },
        select: { id: true, sku: true },
      })
      const variantSkuToId = new Map(createdVariants.map(v => [v.sku, v.id]))

      // Create all variant option values in batch
      const allOptionValues: Array<{ variantId: string; optionValueId: string }> = []
      for (const variant of validated.variants) {
        const variantId = variantSkuToId.get(variant.sku)
        if (variantId && variant.optionValueIds.length > 0) {
          for (const optionValueId of variant.optionValueIds) {
            allOptionValues.push({ variantId, optionValueId })
          }
        }
      }
      
      if (allOptionValues.length > 0) {
        await tx.variantOptionValue.createMany({
          data: allOptionValues,
        })
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

    // === PHASE 1: Pre-load and create option types/values before transaction ===
    const optionTypeMap: Record<string, string> = {} // name -> id
    const optionValueMap: Record<string, Record<string, string>> = {} // typeName -> { value -> id }

    // Collect all option type names and values
    const optionTypeNames = validated.optionGroups.map(g => g.name)
    const optionValuesByType = new Map<string, string[]>()
    for (const group of validated.optionGroups) {
      optionValuesByType.set(group.name.toLowerCase(), group.values)
    }

    // Batch load existing option types
    const existingOptionTypes = await prisma.optionType.findMany({
      where: { name: { in: optionTypeNames, mode: 'insensitive' } },
    })
    for (const ot of existingOptionTypes) {
      optionTypeMap[ot.name] = ot.id
      // Also map by original name from input (case-insensitive match)
      const matchingGroup = validated.optionGroups.find(
        g => g.name.toLowerCase() === ot.name.toLowerCase()
      )
      if (matchingGroup) {
        optionTypeMap[matchingGroup.name] = ot.id
      }
    }

    // Create missing option types
    const existingTypeNamesLower = existingOptionTypes.map(t => t.name.toLowerCase())
    const missingTypeNames = optionTypeNames.filter(n => !existingTypeNamesLower.includes(n.toLowerCase()))
    if (missingTypeNames.length > 0) {
      await prisma.optionType.createMany({
        data: missingTypeNames.map(name => ({ name })),
        skipDuplicates: true,
      })
      const newTypes = await prisma.optionType.findMany({
        where: { name: { in: missingTypeNames, mode: 'insensitive' } },
      })
      for (const ot of newTypes) {
        optionTypeMap[ot.name] = ot.id
        const matchingGroup = validated.optionGroups.find(
          g => g.name.toLowerCase() === ot.name.toLowerCase()
        )
        if (matchingGroup) {
          optionTypeMap[matchingGroup.name] = ot.id
        }
      }
    }

    // Initialize optionValueMap for all groups
    for (const group of validated.optionGroups) {
      optionValueMap[group.name] = {}
    }

    // Batch load existing option values for all types
    const allTypeIds = [...new Set(Object.values(optionTypeMap))]
    const existingOptionValues = await prisma.optionValue.findMany({
      where: { optionTypeId: { in: allTypeIds } },
      include: { optionType: true },
    })
    for (const ov of existingOptionValues) {
      const groupName = validated.optionGroups.find(
        g => optionTypeMap[g.name] === ov.optionTypeId
      )?.name
      if (groupName && optionValueMap[groupName]) {
        optionValueMap[groupName][ov.value] = ov.id
        // Also store lowercase key for case-insensitive lookup
        optionValueMap[groupName][ov.value.toLowerCase()] = ov.id
      }
    }

    // Create missing option values
    const missingOptionValues: Array<{ optionTypeId: string; value: string; groupName: string }> = []
    for (const group of validated.optionGroups) {
      const typeId = optionTypeMap[group.name]
      if (!typeId) continue
      for (const value of group.values) {
        if (!optionValueMap[group.name][value] && !optionValueMap[group.name][value.toLowerCase()]) {
          missingOptionValues.push({ optionTypeId: typeId, value, groupName: group.name })
        }
      }
    }

    if (missingOptionValues.length > 0) {
      await prisma.optionValue.createMany({
        data: missingOptionValues.map(({ optionTypeId, value }) => ({ optionTypeId, value })),
        skipDuplicates: true,
      })
      const newValues = await prisma.optionValue.findMany({
        where: {
          OR: missingOptionValues.map(mv => ({
            optionTypeId: mv.optionTypeId,
            value: { equals: mv.value, mode: 'insensitive' as const },
          })),
        },
      })
      for (const ov of newValues) {
        const mv = missingOptionValues.find(
          m => m.optionTypeId === ov.optionTypeId && m.value.toLowerCase() === ov.value.toLowerCase()
        )
        if (mv && optionValueMap[mv.groupName]) {
          optionValueMap[mv.groupName][ov.value] = ov.id
          optionValueMap[mv.groupName][ov.value.toLowerCase()] = ov.id
        }
      }
    }

    // === PHASE 2: Create product and variants in transaction ===
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

      // Create all variants in batch
      await tx.productVariant.createMany({
        data: validated.variants.map(variant => ({
          productId: newProduct.id,
          sku: variant.sku,
          barcode: variant.barcode || null,
          name: variant.options.map(o => o.value).join(', '),
          costPrice: variant.costPrice,
          sellingPrice: variant.sellingPrice,
          reorderPoint: variant.reorderPoint,
          minQty: variant.minQty,
          maxQty: variant.maxQty,
          lowStockAlert: variant.lowStockAlert,
        })),
      })

      // Fetch created variants to get their IDs
      const createdVariants = await tx.productVariant.findMany({
        where: { productId: newProduct.id },
        select: { id: true, sku: true, costPrice: true },
      })
      const variantSkuToId = new Map(createdVariants.map(v => [v.sku, v.id]))

      // Create all variant option values in batch
      const allOptionValueLinks: Array<{ variantId: string; optionValueId: string }> = []
      for (const variant of validated.variants) {
        const variantId = variantSkuToId.get(variant.sku)
        if (!variantId) continue
        
        for (const opt of variant.options) {
          const optionValueId = optionValueMap[opt.groupName]?.[opt.value] 
            || optionValueMap[opt.groupName]?.[opt.value.toLowerCase()]
          if (optionValueId) {
            allOptionValueLinks.push({ variantId, optionValueId })
          }
        }
      }

      if (allOptionValueLinks.length > 0) {
        await tx.variantOptionValue.createMany({
          data: allOptionValueLinks,
        })
      }

      // Create initial stock if provided
      if (validated.initialStock && validated.initialStock.items.length > 0) {
        const { locationId, note, items } = validated.initialStock
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

          // Batch create stock balances
          // Note: Using sequential upsert here because Prisma doesn't support batch upsert
          // and we need to handle both create and update cases with increment
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
