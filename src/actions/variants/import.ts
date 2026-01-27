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

// Cache for option types and values to avoid repeated DB queries
const optionTypeCache = new Map<string, string>() // name -> id
const optionValueCache = new Map<string, string>() // "typeId:value" -> id

/**
 * Get or create option type by name
 */
async function getOrCreateOptionType(name: string): Promise<string> {
  const cacheKey = name.toLowerCase()
  if (optionTypeCache.has(cacheKey)) {
    return optionTypeCache.get(cacheKey)!
  }

  // Try to find existing
  let optionType = await prisma.optionType.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })

  if (!optionType) {
    // Create new option type
    optionType = await prisma.optionType.create({
      data: { name },
    })
  }

  optionTypeCache.set(cacheKey, optionType.id)
  return optionType.id
}

/**
 * Get or create option value
 */
async function getOrCreateOptionValue(optionTypeId: string, value: string): Promise<string> {
  const cacheKey = `${optionTypeId}:${value.toLowerCase()}`
  if (optionValueCache.has(cacheKey)) {
    return optionValueCache.get(cacheKey)!
  }

  // Try to find existing
  let optionValue = await prisma.optionValue.findFirst({
    where: {
      optionTypeId,
      value: { equals: value, mode: 'insensitive' },
    },
  })

  if (!optionValue) {
    // Create new option value
    optionValue = await prisma.optionValue.create({
      data: {
        optionTypeId,
        value,
      },
    })
  }

  optionValueCache.set(cacheKey, optionValue.id)
  return optionValue.id
}

/**
 * Update existing variants from CSV data
 * Match by SKU, update fields if changed
 */
export async function updateVariantsFromCSV(
  rows: VariantUpdateRow[]
): Promise<ActionResult<UpdateVariantsResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  // Clear cache at start of import
  optionTypeCache.clear()
  optionValueCache.clear()

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

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Account for header row

    try {
      if (!row.sku) {
        result.errors.push(`Row ${rowNum}: SKU ต้องไม่ว่าง`)
        continue
      }

      // Find variant by SKU with current options
      const variant = await prisma.productVariant.findUnique({
        where: { sku: row.sku },
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

      if (!variant) {
        result.errors.push(`Row ${rowNum}: ไม่พบ Variant SKU "${row.sku}"`)
        continue
      }

      // Build update data
      const updateData: Record<string, unknown> = {}
      let hasChanges = false
      let optionChanges = false

      // Barcode
      if (row.barcode !== undefined) {
        const newBarcode = row.barcode || null
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
          // Find current option value for this type
          const currentOption = variant.optionValues.find(
            ov => ov.optionValue.optionType.name.toLowerCase() === optionTypeName.toLowerCase()
          )

          if (currentOption) {
            // Check if value changed
            if (currentOption.optionValue.value !== newValue) {
              // Get or create the new option value
              const optionTypeId = currentOption.optionValue.optionTypeId
              const newOptionValueId = await getOrCreateOptionValue(optionTypeId, newValue)

              // Update the variant-option relation
              await prisma.variantOptionValue.update({
                where: { id: currentOption.id },
                data: { optionValueId: newOptionValueId },
              })

              optionChanges = true
            }
          } else {
            // This variant doesn't have this option type - create it
            const optionTypeId = await getOrCreateOptionType(optionTypeName)
            const optionValueId = await getOrCreateOptionValue(optionTypeId, newValue)

            await prisma.variantOptionValue.create({
              data: {
                variantId: variant.id,
                optionValueId,
              },
            })

            optionChanges = true
          }
        }
      }

      // Update variant if has field changes
      if (hasChanges) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: updateData,
        })
        result.updated++
      } else if (optionChanges) {
        result.optionsUpdated++
      } else {
        result.skipped++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Row ${rowNum} (${row.sku}): ${message}`)
    }
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
