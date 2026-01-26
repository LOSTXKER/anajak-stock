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
  errors: string[]
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

  const result: UpdateVariantsResult = {
    total: rows.length,
    updated: 0,
    skipped: 0,
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

      // Find variant by SKU
      const variant = await prisma.productVariant.findUnique({
        where: { sku: row.sku },
      })

      if (!variant) {
        result.errors.push(`Row ${rowNum}: ไม่พบ Variant SKU "${row.sku}"`)
        continue
      }

      // Build update data
      const updateData: Record<string, unknown> = {}
      let hasChanges = false

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

      // Update if has changes
      if (hasChanges) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: updateData,
        })
        result.updated++
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
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    },
  })

  revalidatePath('/products')

  if (result.errors.length > 0 && result.updated === 0) {
    return { success: false, error: result.errors.join('\n') }
  }

  return { success: true, data: result }
}
