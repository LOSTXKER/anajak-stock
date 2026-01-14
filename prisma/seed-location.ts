import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function seedLocation() {
  console.log('🏗️  Creating default location...')

  // Get first warehouse
  const warehouse = await prisma.warehouse.findFirst({
    where: { active: true },
  })

  if (!warehouse) {
    console.log('❌ No warehouse found! Please create a warehouse first.')
    return
  }

  console.log(`📦 Found warehouse: ${warehouse.name}`)

  // Check if location already exists
  const existing = await prisma.location.findFirst({
    where: { warehouseId: warehouse.id, code: 'MAIN' },
  })

  if (existing) {
    console.log('✅ Location MAIN already exists')
    return
  }

  // Create default location
  const location = await prisma.location.create({
    data: {
      warehouseId: warehouse.id,
      code: 'MAIN',
      name: 'พื้นที่จัดเก็บหลัก',
      active: true,
    },
  })

  console.log(`✅ Created location: ${location.code} - ${location.name}`)
  console.log('\n🎉 Done! You can now add stock to this location.')
}

seedLocation()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
