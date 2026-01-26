/**
 * Script to sync optionGroups from existing variants
 * Run with: npx tsx prisma/sync-option-groups.ts
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

async function syncOptionGroups() {
  console.log('Starting sync of optionGroups...')

  // Get all products with variants
  const products = await prisma.product.findMany({
    where: {
      hasVariants: true,
      deletedAt: null,
    },
    include: {
      variants: {
        where: { active: true, deletedAt: null },
        include: {
          optionValues: {
            include: {
              optionValue: {
                include: {
                  optionType: true,
                },
              },
            },
          },
        },
      },
    },
  })

  console.log(`Found ${products.length} products with variants`)

  let updatedCount = 0

  for (const product of products) {
    // Extract option groups from variants
    const optionGroupsMap = new Map<string, Set<string>>()

    for (const variant of product.variants) {
      for (const vov of variant.optionValues) {
        const typeName = vov.optionValue.optionType.name
        const value = vov.optionValue.value

        if (!optionGroupsMap.has(typeName)) {
          optionGroupsMap.set(typeName, new Set())
        }
        optionGroupsMap.get(typeName)!.add(value)
      }
    }

    // Convert to array format
    const optionGroups = Array.from(optionGroupsMap.entries()).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet).sort(),
    }))

    if (optionGroups.length > 0) {
      // Update product
      await prisma.product.update({
        where: { id: product.id },
        data: { optionGroups },
      })

      console.log(`Updated ${product.sku}: ${optionGroups.map(g => `${g.name}(${g.values.length})`).join(', ')}`)
      updatedCount++
    }
  }

  console.log(`\nDone! Updated ${updatedCount} products`)
}

syncOptionGroups()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
