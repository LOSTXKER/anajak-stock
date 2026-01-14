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

async function checkData() {
  console.log('\n📦 Checking Warehouses...')
  const warehouses = await prisma.warehouse.findMany({
    include: {
      _count: { select: { locations: true } }
    }
  })
  console.log('Warehouses:', warehouses.length)
  warehouses.forEach(w => {
    console.log(`  - ${w.code}: ${w.name} (${w._count.locations} locations, active: ${w.active})`)
  })

  console.log('\n📍 Checking Locations...')
  const locations = await prisma.location.findMany({
    include: { warehouse: true }
  })
  console.log('Locations:', locations.length)
  locations.forEach(l => {
    console.log(`  - ${l.code}: ${l.name} | Warehouse: ${l.warehouse?.name || 'N/A'} | active: ${l.active} | deleted: ${l.deletedAt ? 'YES' : 'NO'}`)
  })

  // Check what getLocations would return
  console.log('\n🔍 What getLocations() would return (active=true, deletedAt=null)...')
  const filteredLocations = await prisma.location.findMany({
    where: {
      active: true,
      deletedAt: null,
    },
    include: { warehouse: true }
  })
  console.log('Filtered Locations:', filteredLocations.length)
  filteredLocations.forEach(l => {
    console.log(`  - ${l.code}: ${l.name} | Warehouse: ${l.warehouse?.name}`)
  })
}

checkData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
