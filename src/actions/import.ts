'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import type { ProductImportRow } from '@/lib/csv-parser'

interface ImportResult {
  total: number
  created: number
  updated: number
  errors: string[]
}

export interface StockImportRow {
  sku: string
  locationCode: string
  qty: number
  unitCost?: number
}

interface StockImportResult {
  total: number
  success: number
  errors: Array<{ row: number; message: string }>
}

export async function importProducts(rows: ProductImportRow[]): Promise<ActionResult<ImportResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  const result: ImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    errors: [],
  }

  // Get or create categories
  const categoryMap = new Map<string, string>()
  const uniqueCategories = [...new Set(rows.map((r) => r.categoryName).filter(Boolean))]

  for (const catName of uniqueCategories) {
    if (!catName) continue
    let category = await prisma.category.findFirst({
      where: { name: { equals: catName, mode: 'insensitive' } },
    })
    if (!category) {
      category = await prisma.category.create({
        data: { name: catName },
      })
    }
    categoryMap.set(catName.toLowerCase(), category.id)
  }

  // Get units
  const unitMap = new Map<string, string>()
  const units = await prisma.unitOfMeasure.findMany()
  for (const unit of units) {
    unitMap.set(unit.code.toLowerCase(), unit.id)
    unitMap.set(unit.name.toLowerCase(), unit.id)
  }

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Account for header row

    try {
      if (!row.sku || !row.name) {
        result.errors.push(`Row ${rowNum}: SKU และชื่อสินค้าต้องไม่ว่าง`)
        continue
      }

      const categoryId = row.categoryName
        ? categoryMap.get(row.categoryName.toLowerCase())
        : null

      const unitId = row.unitCode
        ? unitMap.get(row.unitCode.toLowerCase())
        : null

      // Check if product exists
      const existingProduct = await prisma.product.findUnique({
        where: { sku: row.sku },
      })

      if (existingProduct) {
        // Update
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name: row.name,
            description: row.description,
            barcode: row.barcode || null,
            categoryId,
            unitId,
            reorderPoint: row.reorderPoint ?? existingProduct.reorderPoint,
            minQty: row.minQty ?? existingProduct.minQty,
            maxQty: row.maxQty ?? existingProduct.maxQty,
            standardCost: row.standardCost ?? existingProduct.standardCost,
          },
        })
        result.updated++
      } else {
        // Create
        await prisma.product.create({
          data: {
            sku: row.sku,
            name: row.name,
            description: row.description,
            barcode: row.barcode || null,
            categoryId,
            unitId,
            reorderPoint: row.reorderPoint ?? 0,
            minQty: row.minQty ?? 0,
            maxQty: row.maxQty ?? 0,
            standardCost: row.standardCost ?? 0,
            lastCost: row.standardCost ?? 0,
          },
        })
        result.created++
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
      refType: 'PRODUCT',
      refId: 'bulk',
      newData: {
        total: result.total,
        created: result.created,
        updated: result.updated,
        errorCount: result.errors.length,
      },
    },
  })

  revalidatePath('/products')

  if (result.errors.length > 0 && result.created === 0 && result.updated === 0) {
    return { success: false, error: result.errors.join('\n') }
  }

  return { success: true, data: result }
}

export async function importStock(rows: StockImportRow[]): Promise<ActionResult<StockImportResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  const result: StockImportResult = {
    total: rows.length,
    success: 0,
    errors: [],
  }

  // Get location map
  const locations = await prisma.location.findMany({
    where: { deletedAt: null },
    include: { warehouse: true },
  })
  const locationMap = new Map<string, { id: string; warehouseId: string }>()
  for (const loc of locations) {
    locationMap.set(loc.code.toLowerCase(), { id: loc.id, warehouseId: loc.warehouseId })
    locationMap.set(`${loc.warehouse.code}/${loc.code}`.toLowerCase(), { id: loc.id, warehouseId: loc.warehouseId })
  }

  // Get next doc number
  const sequence = await prisma.docSequence.upsert({
    where: { docType: 'MOVEMENT' },
    update: { currentNo: { increment: 1 } },
    create: {
      docType: 'MOVEMENT',
      prefix: 'MV',
      currentNo: 1,
      padLength: 6,
    },
  })

  const paddedNo = String(sequence.currentNo).padStart(sequence.padLength, '0')
  const yearMonth = new Date().toISOString().slice(2, 7).replace('-', '')
  const docNumber = `IMP${yearMonth}${paddedNo}`

  // Process rows
  const validLines: Array<{
    productId: string
    variantId: string | null
    locationId: string
    qty: number
    unitCost: number
  }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    try {
      if (!row.sku || !row.locationCode || row.qty === undefined) {
        result.errors.push({ row: rowNum, message: 'SKU, รหัสตำแหน่ง และจำนวน ต้องไม่ว่าง' })
        continue
      }

      // Find product or variant
      let productId: string | null = null
      let variantId: string | null = null

      const product = await prisma.product.findUnique({
        where: { sku: row.sku },
      })

      if (product) {
        productId = product.id
      } else {
        // Try finding as variant
        const variant = await prisma.productVariant.findUnique({
          where: { sku: row.sku },
        })
        if (variant) {
          productId = variant.productId
          variantId = variant.id
        }
      }

      if (!productId) {
        result.errors.push({ row: rowNum, message: `ไม่พบสินค้า SKU: ${row.sku}` })
        continue
      }

      // Find location
      const location = locationMap.get(row.locationCode.toLowerCase())
      if (!location) {
        result.errors.push({ row: rowNum, message: `ไม่พบตำแหน่ง: ${row.locationCode}` })
        continue
      }

      validLines.push({
        productId,
        variantId,
        locationId: location.id,
        qty: row.qty,
        unitCost: row.unitCost ?? 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push({ row: rowNum, message })
    }
  }

  if (validLines.length === 0) {
    return { success: false, error: 'ไม่มีรายการที่ถูกต้อง' }
  }

  // Create adjustment movement
  try {
    await prisma.$transaction(async (tx) => {
      // Create movement
      const movement = await tx.stockMovement.create({
        data: {
          docNumber,
          type: 'ADJUST',
          refType: 'IMPORT',
          status: 'POSTED',
          note: `นำเข้าสต๊อคจากไฟล์ (${validLines.length} รายการ)`,
          createdById: session.id,
          approvedById: session.id,
          postedAt: new Date(),
          lines: {
            create: validLines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              toLocationId: line.locationId,
              qty: line.qty,
              unitCost: line.unitCost,
              note: 'นำเข้าจากไฟล์',
            })),
          },
        },
      })

      // Update stock balances
      for (const line of validLines) {
        await tx.stockBalance.upsert({
          where: {
            productId_variantId_locationId: {
              productId: line.productId,
              variantId: line.variantId ?? '',
              locationId: line.locationId,
            },
          },
          update: {
            qtyOnHand: { increment: line.qty },
          },
          create: {
            productId: line.productId,
            variantId: line.variantId,
            locationId: line.locationId,
            qtyOnHand: line.qty,
          },
        })
      }

      result.success = validLines.length
    })
  } catch (error) {
    console.error('Error importing stock:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการนำเข้าสต๊อค' }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: session.id,
      action: 'IMPORT',
      refType: 'STOCK',
      refId: docNumber,
      newData: {
        total: result.total,
        success: result.success,
        errorCount: result.errors.length,
      },
    },
  })

  revalidatePath('/stock')
  revalidatePath('/movements')

  return { success: true, data: result }
}

export async function validateProductImport(rows: ProductImportRow[]): Promise<{
  valid: ProductImportRow[]
  errors: Array<{ row: number; field: string; message: string }>
}> {
  const errors: Array<{ row: number; field: string; message: string }> = []
  const valid: ProductImportRow[] = []
  const seenSkus = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    let hasError = false

    // Required fields
    if (!row.sku || row.sku.trim() === '') {
      errors.push({ row: rowNum, field: 'sku', message: 'SKU ต้องไม่ว่าง' })
      hasError = true
    } else if (seenSkus.has(row.sku)) {
      errors.push({ row: rowNum, field: 'sku', message: 'SKU ซ้ำในไฟล์' })
      hasError = true
    } else {
      seenSkus.add(row.sku)
    }

    if (!row.name || row.name.trim() === '') {
      errors.push({ row: rowNum, field: 'name', message: 'ชื่อสินค้าต้องไม่ว่าง' })
      hasError = true
    }

    // Numeric validation
    if (row.reorderPoint !== undefined && row.reorderPoint < 0) {
      errors.push({ row: rowNum, field: 'reorderPoint', message: 'Reorder Point ต้องไม่ติดลบ' })
      hasError = true
    }

    if (row.standardCost !== undefined && row.standardCost < 0) {
      errors.push({ row: rowNum, field: 'standardCost', message: 'ราคาทุนต้องไม่ติดลบ' })
      hasError = true
    }

    if (!hasError) {
      valid.push(row)
    }
  }

  return { valid, errors }
}

export async function validateStockImport(rows: StockImportRow[]): Promise<{
  valid: StockImportRow[]
  errors: Array<{ row: number; field: string; message: string }>
}> {
  const errors: Array<{ row: number; field: string; message: string }> = []
  const valid: StockImportRow[] = []

  // Get existing SKUs and locations
  const products = await prisma.product.findMany({ select: { sku: true } })
  const variants = await prisma.productVariant.findMany({ select: { sku: true } })
  const skuSet = new Set([...products.map(p => p.sku), ...variants.map(v => v.sku)])

  const locations = await prisma.location.findMany({
    where: { deletedAt: null },
    include: { warehouse: true },
  })
  const locationSet = new Set<string>()
  for (const loc of locations) {
    locationSet.add(loc.code.toLowerCase())
    locationSet.add(`${loc.warehouse.code}/${loc.code}`.toLowerCase())
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    let hasError = false

    if (!row.sku || row.sku.trim() === '') {
      errors.push({ row: rowNum, field: 'sku', message: 'SKU ต้องไม่ว่าง' })
      hasError = true
    } else if (!skuSet.has(row.sku)) {
      errors.push({ row: rowNum, field: 'sku', message: `ไม่พบ SKU: ${row.sku}` })
      hasError = true
    }

    if (!row.locationCode || row.locationCode.trim() === '') {
      errors.push({ row: rowNum, field: 'locationCode', message: 'รหัสตำแหน่งต้องไม่ว่าง' })
      hasError = true
    } else if (!locationSet.has(row.locationCode.toLowerCase())) {
      errors.push({ row: rowNum, field: 'locationCode', message: `ไม่พบตำแหน่ง: ${row.locationCode}` })
      hasError = true
    }

    if (row.qty === undefined || row.qty < 0) {
      errors.push({ row: rowNum, field: 'qty', message: 'จำนวนต้องไม่ติดลบ' })
      hasError = true
    }

    if (!hasError) {
      valid.push(row)
    }
  }

  return { valid, errors }
}
