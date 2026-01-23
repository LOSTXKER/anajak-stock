/**
 * Script to fix GRN lines that are missing variantId
 * by copying variantId from related PO lines
 * 
 * Run with: npx tsx prisma/fix-grn-variants.ts
 */

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

async function fixGRNVariants() {
  console.log('🔍 Finding GRN lines without variantId...')

  // Find all GRN lines that don't have variantId but their PO lines do
  const grnLines = await prisma.gRNLine.findMany({
    where: {
      variantId: null,
    },
    include: {
      poLine: {
        select: {
          id: true,
          variantId: true,
        },
      },
      grn: {
        select: {
          grnNumber: true,
        },
      },
    },
  })

  console.log(`📋 Found ${grnLines.length} GRN lines to check`)

  let updatedCount = 0
  let skippedCount = 0

  for (const line of grnLines) {
    if (line.poLine.variantId) {
      await prisma.gRNLine.update({
        where: { id: line.id },
        data: { variantId: line.poLine.variantId },
      })
      updatedCount++
      console.log(`✅ Updated GRN line in ${line.grn.grnNumber} with variantId: ${line.poLine.variantId}`)
    } else {
      skippedCount++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   Updated: ${updatedCount} lines`)
  console.log(`   Skipped (no variant in PO): ${skippedCount} lines`)

  // Also fix movement lines
  console.log('\n🔍 Finding Movement lines without variantId...')

  const movementLines = await prisma.movementLine.findMany({
    where: {
      variantId: null,
      movement: {
        refType: 'GRN',
      },
    },
    include: {
      movement: {
        select: {
          refId: true,
          docNumber: true,
        },
      },
    },
  })

  console.log(`📋 Found ${movementLines.length} Movement lines to check`)

  let movementUpdatedCount = 0

  for (const line of movementLines) {
    // Find the GRN line to get variantId
    const grnLine = await prisma.gRNLine.findFirst({
      where: {
        grnId: line.movement.refId!,
        productId: line.productId,
        variantId: { not: null },
      },
      select: {
        variantId: true,
      },
    })

    if (grnLine?.variantId) {
      await prisma.movementLine.update({
        where: { id: line.id },
        data: { variantId: grnLine.variantId },
      })
      movementUpdatedCount++
      console.log(`✅ Updated Movement line in ${line.movement.docNumber} with variantId: ${grnLine.variantId}`)
    }
  }

  console.log('\n📊 Movement Summary:')
  console.log(`   Updated: ${movementUpdatedCount} lines`)

  console.log('\n✨ Done!')
}

fixGRNVariants()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
