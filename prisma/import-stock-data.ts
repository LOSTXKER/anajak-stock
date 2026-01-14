import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const prisma = createPrismaClient()

interface StockRow {
  variantSku: string
  productName: string
  color: string
  size: string
  sellingPrice: number | null
  cost: number | null
}

function parseStockFile(): StockRow[] {
  const filePath = path.join(__dirname, '..', 'stock.md')
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  
  const rows: StockRow[] = []
  
  // Skip header line: รหัส,เสื้อ,สี,ไซส์,ราคา,ทุน,กำไร
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    if (cols.length >= 6) {
      rows.push({
        variantSku: cols[0],
        productName: cols[1],
        color: cols[2],
        size: cols[3],
        sellingPrice: cols[4] ? parseFloat(cols[4]) : null, // ราคาขาย
        cost: cols[5] ? parseFloat(cols[5]) : null,          // ต้นทุน
      })
    }
  }
  
  return rows
}

function extractProductSku(variantSku: string): string {
  // S008-S001 -> S008
  // S003-S1 -> S003
  const match = variantSku.match(/^(S\d+)-/)
  return match ? match[1] : variantSku
}

interface GroupedProduct {
  sku: string
  name: string
  variants: Array<{
    variantSku: string
    color: string
    size: string
    cost: number
    sellingPrice: number
  }>
}

function groupByProduct(rows: StockRow[]): GroupedProduct[] {
  const productMap = new Map<string, GroupedProduct>()
  
  for (const row of rows) {
    const productSku = extractProductSku(row.variantSku)
    
    if (!productMap.has(productSku)) {
      productMap.set(productSku, {
        sku: productSku,
        name: row.productName,
        variants: [],
      })
    }
    
    const product = productMap.get(productSku)!
    product.variants.push({
      variantSku: row.variantSku,
      color: row.color,
      size: row.size || '',
      cost: row.cost ?? 0,
      sellingPrice: row.sellingPrice ?? 0,
    })
  }
  
  return Array.from(productMap.values())
}

async function importProducts(products: GroupedProduct[]) {
  console.log(`📦 กำลัง import ${products.length} สินค้า...`)
  
  // Get or create category "เสื้อ"
  let category = await prisma.category.findFirst({
    where: { name: 'เสื้อ' }
  })
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'เสื้อ' }
    })
    console.log('✅ สร้างหมวดหมู่ "เสื้อ"')
  }
  
  // Get or create unit "PCS"
  let unit = await prisma.unitOfMeasure.findFirst({
    where: { code: 'PCS' }
  })
  if (!unit) {
    unit = await prisma.unitOfMeasure.create({
      data: { code: 'PCS', name: 'ชิ้น' }
    })
    console.log('✅ สร้างหน่วย "PCS"')
  }
  
  // Get or create option types
  let colorType = await prisma.optionType.findFirst({
    where: { name: { in: ['สี', 'Color'] } }
  })
  if (!colorType) {
    colorType = await prisma.optionType.create({
      data: { name: 'สี', displayOrder: 1 }
    })
    console.log('✅ สร้าง Option Type "สี"')
  }
  
  let sizeType = await prisma.optionType.findFirst({
    where: { name: { in: ['ไซส์', 'Size'] } }
  })
  if (!sizeType) {
    sizeType = await prisma.optionType.create({
      data: { name: 'ไซส์', displayOrder: 2 }
    })
    console.log('✅ สร้าง Option Type "ไซส์"')
  }
  
  // Cache for option values
  const colorCache = new Map<string, string>()
  const sizeCache = new Map<string, string>()
  
  async function getOrCreateOptionValue(
    optionTypeId: string,
    value: string,
    cache: Map<string, string>
  ): Promise<string> {
    if (!value) return ''
    
    const key = value.toLowerCase()
    if (cache.has(key)) {
      return cache.get(key)!
    }
    
    let optionValue = await prisma.optionValue.findFirst({
      where: {
        optionTypeId,
        value: { equals: value, mode: 'insensitive' },
      },
    })
    
    if (!optionValue) {
      optionValue = await prisma.optionValue.create({
        data: { optionTypeId, value },
      })
    }
    
    cache.set(key, optionValue.id)
    return optionValue.id
  }
  
  let productsCreated = 0
  let productsUpdated = 0
  let variantsCreated = 0
  let variantsSkipped = 0
  
  for (const productData of products) {
    // Calculate average cost for the product
    const validCosts = productData.variants.filter(v => v.cost > 0).map(v => v.cost)
    const avgCost = validCosts.length > 0 
      ? validCosts.reduce((a, b) => a + b, 0) / validCosts.length 
      : 0
    
    // Check if product exists
    let product = await prisma.product.findUnique({
      where: { sku: productData.sku }
    })
    
    if (product) {
      // Update product
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          name: productData.name,
          categoryId: category.id,
          unitId: unit.id,
          hasVariants: productData.variants.length > 0,
          standardCost: avgCost,
        },
      })
      productsUpdated++
    } else {
      // Create product
      product = await prisma.product.create({
        data: {
          sku: productData.sku,
          name: productData.name,
          categoryId: category.id,
          unitId: unit.id,
          hasVariants: productData.variants.length > 0,
          standardCost: avgCost,
          lastCost: avgCost,
          reorderPoint: 10,
        },
      })
      productsCreated++
    }
    
    // Create or update variants
    for (const variantData of productData.variants) {
      // Check if variant exists
      const existingVariant = await prisma.productVariant.findUnique({
        where: { sku: variantData.variantSku }
      })
      
      if (existingVariant) {
        // Update existing variant with selling price
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            costPrice: variantData.cost,
            sellingPrice: variantData.sellingPrice,
            lastCost: variantData.cost,
          },
        })
        variantsSkipped++ // Now actually updated
        continue
      }
      
      // Create variant
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: variantData.variantSku,
          costPrice: variantData.cost,
          sellingPrice: variantData.sellingPrice,
          lastCost: variantData.cost,
          active: true,
        },
      })
      variantsCreated++
      
      // Create option value associations
      if (variantData.color) {
        const colorValueId = await getOrCreateOptionValue(colorType.id, variantData.color, colorCache)
        if (colorValueId) {
          await prisma.variantOptionValue.create({
            data: { variantId: variant.id, optionValueId: colorValueId },
          })
        }
      }
      
      if (variantData.size) {
        const sizeValueId = await getOrCreateOptionValue(sizeType.id, variantData.size, sizeCache)
        if (sizeValueId) {
          await prisma.variantOptionValue.create({
            data: { variantId: variant.id, optionValueId: sizeValueId },
          })
        }
      }
    }
    
    console.log(`  ✓ ${productData.sku}: ${productData.name} (${productData.variants.length} variants)`)
  }
  
  console.log('\n📊 สรุปผลการ Import:')
  console.log(`  • สินค้าสร้างใหม่: ${productsCreated}`)
  console.log(`  • สินค้าอัปเดต: ${productsUpdated}`)
  console.log(`  • ตัวเลือกสร้างใหม่: ${variantsCreated}`)
  console.log(`  • ตัวเลือกอัปเดต (เพิ่มราคาขาย): ${variantsSkipped}`)
}

async function main() {
  console.log('🚀 เริ่มต้น Import ข้อมูลจาก stock.md...\n')
  
  const rows = parseStockFile()
  console.log(`📄 พบข้อมูล ${rows.length} แถว\n`)
  
  const products = groupByProduct(rows)
  console.log(`📦 จัดกลุ่มได้ ${products.length} สินค้า:\n`)
  
  for (const p of products) {
    console.log(`  • ${p.sku}: ${p.name} (${p.variants.length} ตัวเลือก)`)
  }
  console.log('')
  
  await importProducts(products)
  
  console.log('\n🎉 Import เสร็จสมบูรณ์!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
