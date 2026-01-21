import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
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

async function fixStockVariants() {
  console.log('Starting stock variant fix...')

  // Get all stock balances without variantId
  const stockBalances = await prisma.stockBalance.findMany({
    where: {
      variantId: null,
    },
    include: {
      product: {
        include: {
          variants: true,
        },
      },
    },
  })

  console.log(`Found ${stockBalances.length} stock balances without variantId`)

  let fixed = 0
  let skipped = 0

  for (const balance of stockBalances) {
    // If product has no variants, skip
    if (balance.product.variants.length === 0) {
      skipped++
      continue
    }

    // If product has exactly one variant, link it
    if (balance.product.variants.length === 1) {
      const variant = balance.product.variants[0]
      await prisma.stockBalance.update({
        where: { id: balance.id },
        data: { variantId: variant.id },
      })
      console.log(`Fixed: ${balance.product.sku} -> variant ${variant.sku}`)
      fixed++
      continue
    }

    // If product has multiple variants, we need to figure out which one
    // For now, we'll check if the product SKU matches a variant SKU pattern
    const matchingVariant = balance.product.variants.find(
      (v) => v.sku === balance.product.sku
    )

    if (matchingVariant) {
      await prisma.stockBalance.update({
        where: { id: balance.id },
        data: { variantId: matchingVariant.id },
      })
      console.log(`Fixed by SKU match: ${balance.product.sku} -> variant ${matchingVariant.sku}`)
      fixed++
    } else {
      console.log(`Skipped (multiple variants, no match): ${balance.product.sku} has ${balance.product.variants.length} variants`)
      skipped++
    }
  }

  console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}`)
}

// Also check movement lines that are missing variantId
async function fixMovementLineVariants() {
  console.log('\nChecking movement lines...')

  const movementLines = await prisma.movementLine.findMany({
    where: {
      variantId: null,
    },
    include: {
      product: {
        include: {
          variants: true,
        },
      },
    },
  })

  console.log(`Found ${movementLines.length} movement lines without variantId`)

  let fixed = 0
  let skipped = 0

  for (const line of movementLines) {
    if (line.product.variants.length === 0) {
      skipped++
      continue
    }

    if (line.product.variants.length === 1) {
      const variant = line.product.variants[0]
      await prisma.movementLine.update({
        where: { id: line.id },
        data: { variantId: variant.id },
      })
      fixed++
      continue
    }

    // Try to match by product SKU = variant SKU
    const matchingVariant = line.product.variants.find(
      (v) => v.sku === line.product.sku
    )

    if (matchingVariant) {
      await prisma.movementLine.update({
        where: { id: line.id },
        data: { variantId: matchingVariant.id },
      })
      fixed++
    } else {
      skipped++
    }
  }

  console.log(`Movement lines - Fixed: ${fixed}, Skipped: ${skipped}`)
}

async function main() {
  try {
    await fixStockVariants()
    await fixMovementLineVariants()
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
