'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import type { VariantUpdateRow } from '@/lib/csv-parser'
import { StockType } from '@/generated/prisma'

interface UpdateVariantsResult {
  total: number
  updated: number
  skipped: number
  optionsUpdated: number
  errors: string[]
}

/**
 * Update existing variants from CSV data - Optimized with batching
 * Match by SKU, update fields if changed
 */
export async function updateVariantsFromCSV(
  rows: VariantUpdateRow[]
): Promise<ActionResult<UpdateVariantsResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  const result: UpdateVariantsResult = {
    total: rows.length,
    updated: 0,
    skipped: 0,
    optionsUpdated: 0,
    errors: [],
  }

  // Valid stock types
  const validStockTypes: Record<string, StockType> = {
    'stocked': StockType.STOCKED,
    'สต๊อค': StockType.STOCKED,
    'made_to_order': StockType.MADE_TO_ORDER,
    'mto': StockType.MADE_TO_ORDER,
    'สั่งผลิต': StockType.MADE_TO_ORDER,
    'drop_ship': StockType.DROP_SHIP,
    'drop': StockType.DROP_SHIP,
    'dropship': StockType.DROP_SHIP,
  }

  try {
    // === PHASE 1: Batch load all variants at once ===
    const skus = rows.map(r => r.sku).filter(Boolean) as string[]
    
    const existingVariants = await prisma.productVariant.findMany({
      where: { sku: { in: skus } },
      include: {
        optionValues: {
          include: {
            optionValue: {
              include: { optionType: true },
            },
          },
        },
      },
    })
    
    const variantMap = new Map(existingVariants.map(v => [v.sku, v]))

    // === PHASE 2: Batch load/create option types and values ===
    
    // Collect all option type names and values from rows
    const optionTypeNames = new Set<string>()
    const optionValuesByType = new Map<string, Set<string>>() // typeName -> values
    
    for (const row of rows) {
      if (row.options) {
        for (const [typeName, value] of Object.entries(row.options)) {
          optionTypeNames.add(typeName.toLowerCase())
          if (!optionValuesByType.has(typeName.toLowerCase())) {
            optionValuesByType.set(typeName.toLowerCase(), new Set())
          }
          optionValuesByType.get(typeName.toLowerCase())!.add(value)
        }
      }
    }

    // Load all option types
    const existingOptionTypes = await prisma.optionType.findMany()
    const optionTypeMap = new Map<string, string>() // name.toLowerCase() -> id
    for (const ot of existingOptionTypes) {
      optionTypeMap.set(ot.name.toLowerCase(), ot.id)
    }

    // Create missing option types
    const missingTypeNames = [...optionTypeNames].filter(n => !optionTypeMap.has(n))
    if (missingTypeNames.length > 0) {
      await prisma.optionType.createMany({
        data: missingTypeNames.map(name => ({ name })),
        skipDuplicates: true,
      })
      const newTypes = await prisma.optionType.findMany({
        where: { name: { in: missingTypeNames, mode: 'insensitive' } },
      })
      for (const ot of newTypes) {
        optionTypeMap.set(ot.name.toLowerCase(), ot.id)
      }
    }

    // Load all option values for relevant types
    const typeIds = [...optionTypeMap.values()]
    const existingOptionValues = await prisma.optionValue.findMany({
      where: { optionTypeId: { in: typeIds } },
    })
    const optionValueMap = new Map<string, string>() // "typeId:value.toLowerCase()" -> id
    for (const ov of existingOptionValues) {
      optionValueMap.set(`${ov.optionTypeId}:${ov.value.toLowerCase()}`, ov.id)
    }

    // Create missing option values
    const missingOptionValues: Array<{ optionTypeId: string; value: string }> = []
    for (const [typeName, values] of optionValuesByType) {
      const typeId = optionTypeMap.get(typeName)
      if (!typeId) continue
      for (const value of values) {
        if (!optionValueMap.has(`${typeId}:${value.toLowerCase()}`)) {
          missingOptionValues.push({ optionTypeId: typeId, value })
        }
      }
    }
    
    if (missingOptionValues.length > 0) {
      await prisma.optionValue.createMany({
        data: missingOptionValues,
        skipDuplicates: true,
      })
      // Re-fetch to get IDs
      const newValues = await prisma.optionValue.findMany({
        where: {
          OR: missingOptionValues.map(mv => ({
            optionTypeId: mv.optionTypeId,
            value: { equals: mv.value, mode: 'insensitive' as const },
          })),
        },
      })
      for (const ov of newValues) {
        optionValueMap.set(`${ov.optionTypeId}:${ov.value.toLowerCase()}`, ov.id)
      }
    }

    // === PHASE 3: Process updates in transaction ===
    
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        if (!row.sku) {
          result.errors.push(`Row ${rowNum}: SKU ต้องไม่ว่าง`)
          continue
        }

        const variant = variantMap.get(row.sku)
        if (!variant) {
          result.errors.push(`Row ${rowNum}: ไม่พบ Variant SKU "${row.sku}"`)
          continue
        }

        // Build update data
        const updateData: Record<string, unknown> = {}
        let hasChanges = false
        let optionChanges = false

        // Barcode - ensure empty string becomes null
        if (row.barcode !== undefined) {
          const newBarcode = row.barcode?.trim() || null
          if (newBarcode !== variant.barcode) {
            updateData.barcode = newBarcode
            hasChanges = true
          }
        }

        // Stock type
        if (row.stockType) {
          const stockTypeKey = row.stockType.toLowerCase()
          const newStockType = validStockTypes[stockTypeKey]
          if (newStockType && newStockType !== variant.stockType) {
            updateData.stockType = newStockType
            hasChanges = true
          }
        }

        // Selling price
        if (row.sellingPrice !== undefined && row.sellingPrice !== Number(variant.sellingPrice)) {
          updateData.sellingPrice = row.sellingPrice
          hasChanges = true
        }

        // Cost price
        if (row.costPrice !== undefined && row.costPrice !== Number(variant.costPrice)) {
          updateData.costPrice = row.costPrice
          hasChanges = true
        }

        // Reorder point
        if (row.reorderPoint !== undefined && row.reorderPoint !== Number(variant.reorderPoint)) {
          updateData.reorderPoint = row.reorderPoint
          hasChanges = true
        }

        // Min Qty
        if (row.minQty !== undefined && row.minQty !== Number(variant.minQty)) {
          updateData.minQty = row.minQty
          hasChanges = true
        }

        // Max Qty
        if (row.maxQty !== undefined && row.maxQty !== Number(variant.maxQty)) {
          updateData.maxQty = row.maxQty
          hasChanges = true
        }

        // Low stock alert
        if (row.lowStockAlert !== undefined) {
          const alertValue = row.lowStockAlert.toLowerCase()
          const newAlert = alertValue === 'y' || alertValue === 'yes' || alertValue === 'true' || alertValue === '1' || alertValue === 'ใช่'
          if (newAlert !== variant.lowStockAlert) {
            updateData.lowStockAlert = newAlert
            hasChanges = true
          }
        }

        // Handle option value updates (สี, ไซส์, etc.)
        if (row.options && Object.keys(row.options).length > 0) {
          for (const [optionTypeName, newValue] of Object.entries(row.options)) {
            const typeId = optionTypeMap.get(optionTypeName.toLowerCase())
            if (!typeId) continue

            const newOptionValueId = optionValueMap.get(`${typeId}:${newValue.toLowerCase()}`)
            if (!newOptionValueId) continue

            // Find current option value for this type
            const currentOption = variant.optionValues.find(
              ov => ov.optionValue.optionType.name.toLowerCase() === optionTypeName.toLowerCase()
            )

            if (currentOption) {
              // Check if value changed
              if (currentOption.optionValue.value.toLowerCase() !== newValue.toLowerCase()) {
                await tx.variantOptionValue.update({
                  where: { id: currentOption.id },
                  data: { optionValueId: newOptionValueId },
                })
                optionChanges = true
              }
            } else {
              // Create new option value association
              await tx.variantOptionValue.create({
                data: {
                  variantId: variant.id,
                  optionValueId: newOptionValueId,
                },
              })
              optionChanges = true
            }
          }
        }

        // Update variant if has field changes
        if (hasChanges) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: updateData,
          })
          result.updated++
        } else if (optionChanges) {
          result.optionsUpdated++
        } else {
          result.skipped++
        }
      }
    }, {
      timeout: 60000, // 1 minute for large imports
      maxWait: 10000,
    })

  } catch (error) {
    console.error('Error updating variants:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: `เกิดข้อผิดพลาด: ${message}` }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: session.id,
      action: 'IMPORT',
      refType: 'VARIANT_UPDATE',
      refId: 'bulk',
      newData: {
        total: result.total,
        updated: result.updated,
        optionsUpdated: result.optionsUpdated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    },
  })

  revalidatePath('/products')

  if (result.errors.length > 0 && result.updated === 0 && result.optionsUpdated === 0) {
    return { success: false, error: result.errors.join('\n') }
  }

  return { success: true, data: result }
}
