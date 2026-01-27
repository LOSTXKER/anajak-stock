'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import type { ProductImportRow, GroupedProductImport } from '@/lib/csv-parser'

interface ImportResult {
  total: number
  created: number
  updated: number
  errors: string[]
}

interface VariantImportResult {
  totalProducts: number
  totalVariants: number
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  variantsUpdated: number
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

/**
 * Import products with variants (Color/Size) - Optimized with batching
 */
export async function importProductsWithVariants(
  products: GroupedProductImport[]
): Promise<ActionResult<VariantImportResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  const result: VariantImportResult = {
    totalProducts: products.length,
    totalVariants: products.reduce((sum, p) => sum + p.variants.length, 0),
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
  }

  try {
    // === PHASE 1: Batch load all reference data ===
    
    // Get all categories at once
    const uniqueCategories = [...new Set(products.map((p) => p.categoryName).filter(Boolean))] as string[]
    const existingCategories = await prisma.category.findMany({
      where: { name: { in: uniqueCategories, mode: 'insensitive' } },
    })
    const categoryMap = new Map<string, string>()
    for (const cat of existingCategories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id)
    }
    
    // Create missing categories in batch
    const missingCategories = uniqueCategories.filter(c => !categoryMap.has(c.toLowerCase()))
    if (missingCategories.length > 0) {
      await prisma.category.createMany({
        data: missingCategories.map(name => ({ name })),
        skipDuplicates: true,
      })
      // Re-fetch to get IDs
      const newCategories = await prisma.category.findMany({
        where: { name: { in: missingCategories, mode: 'insensitive' } },
      })
      for (const cat of newCategories) {
        categoryMap.set(cat.name.toLowerCase(), cat.id)
      }
    }

    // Get all units at once
    const unitMap = new Map<string, string>()
    const units = await prisma.unitOfMeasure.findMany()
    for (const unit of units) {
      unitMap.set(unit.code.toLowerCase(), unit.id)
      unitMap.set(unit.name.toLowerCase(), unit.id)
    }

    // Get or create option types for Color and Size
    let [colorOptionType, sizeOptionType] = await Promise.all([
      prisma.optionType.findFirst({
        where: { OR: [
          { name: { equals: 'สี', mode: 'insensitive' } },
          { name: { equals: 'Color', mode: 'insensitive' } },
        ]},
      }),
      prisma.optionType.findFirst({
        where: { OR: [
          { name: { equals: 'ไซส์', mode: 'insensitive' } },
          { name: { equals: 'Size', mode: 'insensitive' } },
        ]},
      }),
    ])

    if (!colorOptionType) {
      colorOptionType = await prisma.optionType.create({
        data: { name: 'สี', displayOrder: 1 },
      })
    }
    if (!sizeOptionType) {
      sizeOptionType = await prisma.optionType.create({
        data: { name: 'ไซส์', displayOrder: 2 },
      })
    }

    // === PHASE 2: Batch load existing products and variants ===
    
    const productSkus = products.map(p => p.sku)
    const allVariantSkus = products.flatMap(p => p.variants.map(v => v.variantSku))
    
    const [existingProducts, existingVariants] = await Promise.all([
      prisma.product.findMany({
        where: { sku: { in: productSkus } },
      }),
      prisma.productVariant.findMany({
        where: { sku: { in: allVariantSkus } },
      }),
    ])
    
    const existingProductMap = new Map(existingProducts.map(p => [p.sku, p]))
    const existingVariantMap = new Map(existingVariants.map(v => [v.sku, v]))

    // === PHASE 3: Batch load/create option values ===
    
    const uniqueColors = [...new Set(products.flatMap(p => p.variants.map(v => v.color).filter(Boolean)))] as string[]
    const uniqueSizes = [...new Set(products.flatMap(p => p.variants.map(v => v.size).filter(Boolean)))] as string[]
    
    // Load existing option values
    const [existingColorValues, existingSizeValues] = await Promise.all([
      prisma.optionValue.findMany({
        where: { optionTypeId: colorOptionType.id, value: { in: uniqueColors, mode: 'insensitive' } },
      }),
      prisma.optionValue.findMany({
        where: { optionTypeId: sizeOptionType.id, value: { in: uniqueSizes, mode: 'insensitive' } },
      }),
    ])
    
    const colorValueMap = new Map<string, string>()
    const sizeValueMap = new Map<string, string>()
    
    for (const ov of existingColorValues) {
      colorValueMap.set(ov.value.toLowerCase(), ov.id)
    }
    for (const ov of existingSizeValues) {
      sizeValueMap.set(ov.value.toLowerCase(), ov.id)
    }
    
    // Create missing option values
    const missingColors = uniqueColors.filter(c => !colorValueMap.has(c.toLowerCase()))
    const missingSizes = uniqueSizes.filter(s => !sizeValueMap.has(s.toLowerCase()))
    
    if (missingColors.length > 0) {
      await prisma.optionValue.createMany({
        data: missingColors.map(value => ({ optionTypeId: colorOptionType!.id, value })),
        skipDuplicates: true,
      })
      const newColorValues = await prisma.optionValue.findMany({
        where: { optionTypeId: colorOptionType.id, value: { in: missingColors, mode: 'insensitive' } },
      })
      for (const ov of newColorValues) {
        colorValueMap.set(ov.value.toLowerCase(), ov.id)
      }
    }
    
    if (missingSizes.length > 0) {
      await prisma.optionValue.createMany({
        data: missingSizes.map(value => ({ optionTypeId: sizeOptionType!.id, value })),
        skipDuplicates: true,
      })
      const newSizeValues = await prisma.optionValue.findMany({
        where: { optionTypeId: sizeOptionType.id, value: { in: missingSizes, mode: 'insensitive' } },
      })
      for (const ov of newSizeValues) {
        sizeValueMap.set(ov.value.toLowerCase(), ov.id)
      }
    }

    // === PHASE 4: Process products and variants in transaction ===
    
    await prisma.$transaction(async (tx) => {
      // Track created products for variant creation
      const createdProductMap = new Map<string, string>()
      
      for (const productData of products) {
        if (!productData.sku || !productData.name) {
          result.errors.push(`Product: SKU และชื่อสินค้าต้องไม่ว่าง`)
          continue
        }

        const categoryId = productData.categoryName
          ? categoryMap.get(productData.categoryName.toLowerCase()) || null
          : null

        const unitId = productData.unitCode
          ? unitMap.get(productData.unitCode.toLowerCase()) || null
          : null

        const existingProduct = existingProductMap.get(productData.sku)

        if (existingProduct) {
          // Update product
          await tx.product.update({
            where: { id: existingProduct.id },
            data: {
              name: productData.name,
              description: productData.description,
              categoryId,
              unitId,
              reorderPoint: productData.reorderPoint ?? existingProduct.reorderPoint,
              standardCost: productData.standardCost ?? existingProduct.standardCost,
              hasVariants: productData.variants.length > 0,
            },
          })
          createdProductMap.set(productData.sku, existingProduct.id)
          result.productsUpdated++
        } else {
          // Create product
          const newProduct = await tx.product.create({
            data: {
              sku: productData.sku,
              name: productData.name,
              description: productData.description,
              categoryId,
              unitId,
              reorderPoint: productData.reorderPoint ?? 0,
              standardCost: productData.standardCost ?? 0,
              lastCost: productData.standardCost ?? 0,
              hasVariants: productData.variants.length > 0,
            },
          })
          createdProductMap.set(productData.sku, newProduct.id)
          result.productsCreated++
        }
      }

      // Process all variants
      const variantsToCreate: Array<{
        productId: string
        sku: string
        barcode: string | null
        costPrice: number
        active: boolean
        color?: string
        size?: string
      }> = []
      
      const variantsToUpdate: Array<{
        id: string
        barcode: string | null
        costPrice: number
      }> = []

      for (const productData of products) {
        const productId = createdProductMap.get(productData.sku)
        if (!productId) continue

        for (const variantData of productData.variants) {
          const existingVariant = existingVariantMap.get(variantData.variantSku)
          
          if (existingVariant) {
            // Use new barcode if provided and not empty, otherwise keep existing
            const newBarcode = variantData.barcode?.trim() || null
            variantsToUpdate.push({
              id: existingVariant.id,
              barcode: newBarcode !== null ? newBarcode : existingVariant.barcode,
              costPrice: variantData.cost ?? Number(existingVariant.costPrice),
            })
            result.variantsUpdated++
          } else {
            variantsToCreate.push({
              productId,
              sku: variantData.variantSku,
              barcode: variantData.barcode?.trim() || null, // Empty string -> null
              costPrice: variantData.cost ?? 0,
              active: true,
              color: variantData.color,
              size: variantData.size,
            })
            result.variantsCreated++
          }
        }
      }

      // Batch update existing variants
      for (const v of variantsToUpdate) {
        await tx.productVariant.update({
          where: { id: v.id },
          data: { barcode: v.barcode?.trim() || null, costPrice: v.costPrice },
        })
      }

      // Create new variants and their option associations
      for (const v of variantsToCreate) {
        const newVariant = await tx.productVariant.create({
          data: {
            productId: v.productId,
            sku: v.sku,
            barcode: v.barcode?.trim() || null, // Ensure empty strings become null
            costPrice: v.costPrice,
            active: v.active,
          },
        })

        // Create option value associations in batch
        const optionValueAssocs: Array<{ variantId: string; optionValueId: string }> = []
        
        if (v.color) {
          const colorValueId = colorValueMap.get(v.color.toLowerCase())
          if (colorValueId) {
            optionValueAssocs.push({ variantId: newVariant.id, optionValueId: colorValueId })
          }
        }
        
        if (v.size) {
          const sizeValueId = sizeValueMap.get(v.size.toLowerCase())
          if (sizeValueId) {
            optionValueAssocs.push({ variantId: newVariant.id, optionValueId: sizeValueId })
          }
        }

        if (optionValueAssocs.length > 0) {
          await tx.variantOptionValue.createMany({
            data: optionValueAssocs,
            skipDuplicates: true,
          })
        }
      }
    }, {
      timeout: 120000, // 2 minutes for large imports
      maxWait: 10000,
    })

  } catch (error) {
    console.error('Error importing products with variants:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: `เกิดข้อผิดพลาด: ${message}` }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: session.id,
      action: 'IMPORT',
      refType: 'PRODUCT_VARIANT',
      refId: 'bulk',
      newData: {
        totalProducts: result.totalProducts,
        totalVariants: result.totalVariants,
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        variantsCreated: result.variantsCreated,
        variantsUpdated: result.variantsUpdated,
        errorCount: result.errors.length,
      },
    },
  })

  revalidatePath('/products')

  if (result.errors.length > 0 && result.productsCreated === 0 && result.productsUpdated === 0) {
    return { success: false, error: result.errors.join('\n') }
  }

  return { success: true, data: result }
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

  try {
    // === PHASE 1: Batch load all reference data ===
    
    // Get all categories at once
    const uniqueCategories = [...new Set(rows.map((r) => r.categoryName).filter(Boolean))] as string[]
    const existingCategories = await prisma.category.findMany({
      where: { name: { in: uniqueCategories, mode: 'insensitive' } },
    })
    const categoryMap = new Map<string, string>()
    for (const cat of existingCategories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id)
    }
    
    // Create missing categories in batch
    const missingCategories = uniqueCategories.filter(c => !categoryMap.has(c.toLowerCase()))
    if (missingCategories.length > 0) {
      await prisma.category.createMany({
        data: missingCategories.map(name => ({ name })),
        skipDuplicates: true,
      })
      const newCategories = await prisma.category.findMany({
        where: { name: { in: missingCategories, mode: 'insensitive' } },
      })
      for (const cat of newCategories) {
        categoryMap.set(cat.name.toLowerCase(), cat.id)
      }
    }

    // Get all units at once
    const unitMap = new Map<string, string>()
    const units = await prisma.unitOfMeasure.findMany()
    for (const unit of units) {
      unitMap.set(unit.code.toLowerCase(), unit.id)
      unitMap.set(unit.name.toLowerCase(), unit.id)
    }

    // === PHASE 2: Batch load existing products ===
    
    const skus = rows.map(r => r.sku).filter(Boolean) as string[]
    const existingProducts = await prisma.product.findMany({
      where: { sku: { in: skus } },
    })
    const existingProductMap = new Map(existingProducts.map(p => [p.sku, p]))

    // === PHASE 3: Process products in transaction ===
    
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        if (!row.sku || !row.name) {
          result.errors.push(`Row ${rowNum}: SKU และชื่อสินค้าต้องไม่ว่าง`)
          continue
        }

        const categoryId = row.categoryName
          ? categoryMap.get(row.categoryName.toLowerCase()) || null
          : null

        const unitId = row.unitCode
          ? unitMap.get(row.unitCode.toLowerCase()) || null
          : null

        const existingProduct = existingProductMap.get(row.sku)

        try {
          if (existingProduct) {
            await tx.product.update({
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
            await tx.product.create({
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
    }, {
      timeout: 60000, // 1 minute for large imports
      maxWait: 10000,
    })

  } catch (error) {
    console.error('Error importing products:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: `เกิดข้อผิดพลาด: ${message}` }
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
    }, {
      timeout: 60000, // 60 seconds - นำเข้าสต๊อคหลายร้อยรายการอาจใช้เวลานาน
      maxWait: 10000,
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
