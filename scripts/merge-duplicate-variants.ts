/**
 * One-time script to merge duplicate variants:
 *   S013-S078 → S013-S183
 *   S013-S079 → S013-S184
 *   S013-S080 → S013-S185
 *   S013-S081 → S013-S186
 *   S013-S082 → S013-S187
 *   S013-S083 → S013-S188
 *   S013-S084 → S013-S189
 *
 * Transfers movementLines and stockBalances from source → target,
 * then soft-deletes the source variant.
 *
 * Usage: npx tsx scripts/merge-duplicate-variants.ts
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
  return { prisma: new PrismaClient({ adapter }), pool }
}

const { prisma, pool } = createPrismaClient()

// Define the mapping: source SKU → target SKU
const MERGE_PAIRS = [
  { source: 'S013-S078', target: 'S013-S183' },
  { source: 'S013-S079', target: 'S013-S184' },
  { source: 'S013-S080', target: 'S013-S185' },
  { source: 'S013-S081', target: 'S013-S186' },
  { source: 'S013-S082', target: 'S013-S187' },
  { source: 'S013-S083', target: 'S013-S188' },
  { source: 'S013-S084', target: 'S013-S189' },
]

async function main() {
  console.log('=== Merge Duplicate Variants ===\n')

  // First, do a dry run to show what will happen
  console.log('--- DRY RUN: Checking variants ---\n')

  for (const pair of MERGE_PAIRS) {
    const source = await prisma.productVariant.findUnique({
      where: { sku: pair.source },
      include: {
        stockBalances: { include: { location: true } },
        movementLines: true,
      },
    })

    const target = await prisma.productVariant.findUnique({
      where: { sku: pair.target },
    })

    if (!source) {
      console.log(`  SKIP: Source ${pair.source} not found`)
      continue
    }
    if (!target) {
      console.log(`  SKIP: Target ${pair.target} not found`)
      continue
    }
    if (source.productId !== target.productId) {
      console.log(`  ERROR: ${pair.source} and ${pair.target} are not on the same product!`)
      continue
    }

    console.log(`  ${pair.source} → ${pair.target}`)
    console.log(`    Movement Lines: ${source.movementLines.length}`)
    console.log(`    Stock Balances: ${source.stockBalances.length}`)
    for (const sb of source.stockBalances) {
      console.log(`      - Location "${sb.location.name}": qty=${sb.qtyOnHand}`)
    }
    if (source.deletedAt) {
      console.log(`    WARNING: Source already soft-deleted at ${source.deletedAt}`)
    }
    console.log()
  }

  // Ask for confirmation
  console.log('--- EXECUTING MERGE ---\n')

  for (const pair of MERGE_PAIRS) {
    const source = await prisma.productVariant.findUnique({
      where: { sku: pair.source },
      include: {
        stockBalances: true,
        movementLines: true,
      },
    })

    const target = await prisma.productVariant.findUnique({
      where: { sku: pair.target },
    })

    if (!source || !target) {
      console.log(`  SKIP: ${pair.source} → ${pair.target} (variant not found)`)
      continue
    }

    if (source.productId !== target.productId) {
      console.log(`  SKIP: ${pair.source} → ${pair.target} (different products)`)
      continue
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Transfer movementLines
        if (source.movementLines.length > 0) {
          const result = await tx.movementLine.updateMany({
            where: { variantId: source.id },
            data: { variantId: target.id },
          })
          console.log(`  ${pair.source}: Transferred ${result.count} movement lines → ${pair.target}`)
        }

        // 2. Transfer stockBalances
        for (const srcBalance of source.stockBalances) {
          const existingTargetBalance = await tx.stockBalance.findUnique({
            where: {
              productId_variantId_locationId: {
                productId: target.productId,
                variantId: target.id,
                locationId: srcBalance.locationId,
              },
            },
          })

          if (existingTargetBalance) {
            // Merge qty
            await tx.stockBalance.update({
              where: { id: existingTargetBalance.id },
              data: {
                qtyOnHand: { increment: srcBalance.qtyOnHand },
              },
            })
            await tx.stockBalance.delete({
              where: { id: srcBalance.id },
            })
            console.log(`  ${pair.source}: Merged stock balance (qty=${srcBalance.qtyOnHand}) into ${pair.target}`)
          } else {
            // Move balance to target variant
            await tx.stockBalance.update({
              where: { id: srcBalance.id },
              data: { variantId: target.id },
            })
            console.log(`  ${pair.source}: Moved stock balance (qty=${srcBalance.qtyOnHand}) to ${pair.target}`)
          }
        }

        // 3. Soft-delete source variant
        await tx.productVariant.update({
          where: { id: source.id },
          data: {
            active: false,
            deletedAt: new Date(),
          },
        })
        console.log(`  ${pair.source}: Soft-deleted`)
      })

      console.log(`  OK: ${pair.source} → ${pair.target}\n`)
    } catch (error) {
      console.error(`  FAILED: ${pair.source} → ${pair.target}:`, error)
    }
  }

  console.log('=== Done ===')
}

main()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
