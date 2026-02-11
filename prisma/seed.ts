import 'dotenv/config'
import { PrismaClient, Role } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

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

async function main() {
  console.log('🌱 Seeding database...')

  // Create document sequences
  const docSequences = [
    { docType: 'MOVEMENT', prefix: 'MOV', currentNo: 0, padLength: 6 },
    { docType: 'PR', prefix: 'PR', currentNo: 0, padLength: 6 },
    { docType: 'PO', prefix: 'PO', currentNo: 0, padLength: 6 },
    { docType: 'GRN', prefix: 'GRN', currentNo: 0, padLength: 6 },
  ]

  for (const seq of docSequences) {
    await prisma.docSequence.upsert({
      where: { docType: seq.docType },
      update: {},
      create: seq,
    })
  }
  console.log('✅ Document sequences created')

  // Create categories
  const categories = [
    { name: 'เสื้อ', description: 'เสื้อทุกประเภท' },
    { name: 'กางเกง', description: 'กางเกงทุกประเภท' },
    { name: 'เสื้อแจ็คเก็ต', description: 'เสื้อแจ็คเก็ตและเสื้อคลุม' },
    { name: 'อุปกรณ์', description: 'อุปกรณ์และวัสดุสิ้นเปลือง' },
    { name: 'วัตถุดิบ', description: 'วัตถุดิบสำหรับการผลิต' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }
  console.log('✅ Categories created')

  // Create units of measure
  const units = [
    { code: 'PCS', name: 'ชิ้น' },
    { code: 'SET', name: 'ชุด' },
    { code: 'DOZ', name: 'โหล' },
    { code: 'BOX', name: 'กล่อง' },
    { code: 'M', name: 'เมตร' },
    { code: 'KG', name: 'กิโลกรัม' },
    { code: 'L', name: 'ลิตร' },
    { code: 'ROLL', name: 'ม้วน' },
  ]

  for (const unit of units) {
    await prisma.unitOfMeasure.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    })
  }
  console.log('✅ Units of measure created')

  // Create warehouses
  const warehouses = [
    { code: 'WH-MAIN', name: 'คลังหลัก', address: 'อาคาร A ชั้น 1' },
    { code: 'WH-PROD', name: 'คลังผลิต', address: 'โรงงาน ชั้น 1' },
    { code: 'WH-SHIP', name: 'คลังจัดส่ง', address: 'อาคาร B ชั้น 1' },
  ]

  for (const wh of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: wh.code },
      update: {},
      create: wh,
    })
  }
  console.log('✅ Warehouses created')

  // Get warehouses for locations
  const mainWarehouse = await prisma.warehouse.findUnique({ where: { code: 'WH-MAIN' } })
  const prodWarehouse = await prisma.warehouse.findUnique({ where: { code: 'WH-PROD' } })

  if (mainWarehouse) {
    const mainLocations = [
      { warehouseId: mainWarehouse.id, code: 'A1-01', name: 'ชั้น A1 ช่อง 01', zone: 'A', rack: '1', shelf: '01' },
      { warehouseId: mainWarehouse.id, code: 'A1-02', name: 'ชั้น A1 ช่อง 02', zone: 'A', rack: '1', shelf: '02' },
      { warehouseId: mainWarehouse.id, code: 'A2-01', name: 'ชั้น A2 ช่อง 01', zone: 'A', rack: '2', shelf: '01' },
      { warehouseId: mainWarehouse.id, code: 'B1-01', name: 'ชั้น B1 ช่อง 01', zone: 'B', rack: '1', shelf: '01' },
    ]

    for (const loc of mainLocations) {
      await prisma.location.upsert({
        where: { warehouseId_code: { warehouseId: loc.warehouseId, code: loc.code } },
        update: {},
        create: loc,
      })
    }
  }

  if (prodWarehouse) {
    const prodLocations = [
      { warehouseId: prodWarehouse.id, code: 'P1-01', name: 'โซนผลิต 1', zone: 'P', rack: '1', shelf: '01' },
      { warehouseId: prodWarehouse.id, code: 'P1-02', name: 'โซนผลิต 2', zone: 'P', rack: '1', shelf: '02' },
    ]

    for (const loc of prodLocations) {
      await prisma.location.upsert({
        where: { warehouseId_code: { warehouseId: loc.warehouseId, code: loc.code } },
        update: {},
        create: loc,
      })
    }
  }
  console.log('✅ Locations created')

  // Create suppliers
  const suppliers = [
    { code: 'SUP-001', name: 'บริษัท ผ้าไทย จำกัด', contactName: 'คุณสมชาย', phone: '02-123-4567', email: 'contact@phathai.com', leadTimeDays: 7 },
    { code: 'SUP-002', name: 'บริษัท เส้นด้าย จำกัด', contactName: 'คุณสมหญิง', phone: '02-234-5678', email: 'sales@sendai.com', leadTimeDays: 5 },
    { code: 'SUP-003', name: 'ร้านอุปกรณ์ตัดเย็บ', contactName: 'คุณวิชัย', phone: '081-234-5678', leadTimeDays: 3 },
  ]

  for (const sup of suppliers) {
    await prisma.supplier.upsert({
      where: { code: sup.code },
      update: {},
      create: sup,
    })
  }
  console.log('✅ Suppliers created')

  // Get category and unit for products
  const shirtCategory = await prisma.category.findUnique({ where: { name: 'เสื้อ' } })
  const jacketCategory = await prisma.category.findUnique({ where: { name: 'เสื้อแจ็คเก็ต' } })
  const materialCategory = await prisma.category.findUnique({ where: { name: 'วัตถุดิบ' } })
  const pcsUnit = await prisma.unitOfMeasure.findUnique({ where: { code: 'PCS' } })
  const meterUnit = await prisma.unitOfMeasure.findUnique({ where: { code: 'M' } })

  // Create sample products
  const products = [
    { sku: 'SHIRT-001', name: 'เสื้อยืดคอกลม ขาว S', categoryId: shirtCategory?.id, unitId: pcsUnit?.id, reorderPoint: 50, standardCost: 120, itemType: 'FINISHED_GOOD' as const },
    { sku: 'SHIRT-002', name: 'เสื้อยืดคอกลม ขาว M', categoryId: shirtCategory?.id, unitId: pcsUnit?.id, reorderPoint: 50, standardCost: 120, itemType: 'FINISHED_GOOD' as const },
    { sku: 'SHIRT-003', name: 'เสื้อยืดคอกลม ขาว L', categoryId: shirtCategory?.id, unitId: pcsUnit?.id, reorderPoint: 50, standardCost: 120, itemType: 'FINISHED_GOOD' as const },
    { sku: 'SHIRT-004', name: 'เสื้อยืดคอกลม ดำ S', categoryId: shirtCategory?.id, unitId: pcsUnit?.id, reorderPoint: 50, standardCost: 120, itemType: 'FINISHED_GOOD' as const },
    { sku: 'SHIRT-005', name: 'เสื้อยืดคอกลม ดำ M', categoryId: shirtCategory?.id, unitId: pcsUnit?.id, reorderPoint: 50, standardCost: 120, itemType: 'FINISHED_GOOD' as const },
    { sku: 'JACKET-001', name: 'แจ็คเก็ตผ้าร่ม ดำ M', categoryId: jacketCategory?.id, unitId: pcsUnit?.id, reorderPoint: 20, standardCost: 450, itemType: 'FINISHED_GOOD' as const },
    { sku: 'JACKET-002', name: 'แจ็คเก็ตผ้าร่ม ดำ L', categoryId: jacketCategory?.id, unitId: pcsUnit?.id, reorderPoint: 20, standardCost: 450, itemType: 'FINISHED_GOOD' as const },
    { sku: 'FABRIC-001', name: 'ผ้าฝ้าย 100% ขาว', categoryId: materialCategory?.id, unitId: meterUnit?.id, reorderPoint: 100, standardCost: 85, itemType: 'RAW_MATERIAL' as const },
    { sku: 'FABRIC-002', name: 'ผ้าฝ้าย 100% ดำ', categoryId: materialCategory?.id, unitId: meterUnit?.id, reorderPoint: 100, standardCost: 85, itemType: 'RAW_MATERIAL' as const },
  ]

  for (const prod of products) {
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: {},
      create: {
        sku: prod.sku,
        name: prod.name,
        categoryId: prod.categoryId,
        unitId: prod.unitId,
        itemType: prod.itemType,
        reorderPoint: prod.reorderPoint,
        standardCost: prod.standardCost,
        lastCost: prod.standardCost,
      },
    })
  }
  console.log('✅ Sample products created')

  // Create initial stock balances
  if (mainWarehouse) {
    const location = await prisma.location.findFirst({ where: { warehouseId: mainWarehouse.id } })
    if (location) {
      const allProducts = await prisma.product.findMany({ where: { hasVariants: false } })
      for (const prod of allProducts) {
        const randomQty = Math.floor(Math.random() * 100) + 10
        // Find existing or create new
        const existing = await prisma.stockBalance.findFirst({
          where: { productId: prod.id, variantId: null, locationId: location.id }
        })
        if (existing) {
          await prisma.stockBalance.update({
            where: { id: existing.id },
            data: { qtyOnHand: randomQty },
          })
        } else {
          await prisma.stockBalance.create({
            data: {
              productId: prod.id,
              variantId: null,
              locationId: location.id,
              qtyOnHand: randomQty,
            },
          })
        }
      }
    }
  }
  console.log('✅ Initial stock balances created')

  // Create settings
  const settings = [
    { key: 'company_name', value: 'Ana Jak T-Shirt Co., Ltd.' },
    { key: 'allow_negative_stock', value: 'false' },
    { key: 'default_vat_rate', value: '7' },
  ]

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }
  console.log('✅ Settings created')

  console.log('\n🎉 Seeding completed!')
  console.log('\n📋 หมายเหตุ:')
  console.log('   - ผู้ใช้จะถูกสร้างอัตโนมัติเมื่อ login ผ่าน Supabase Auth')
  console.log('   - สร้าง user ใน Supabase Dashboard: Authentication > Users')
  console.log('   - หลัง login ครั้งแรก ให้ไปอัปเดต role ใน database')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
