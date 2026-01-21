import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      stockBalances: { fixed: 0, skipped: 0 },
      movementLines: { fixed: 0, skipped: 0 },
      variantNames: { fixed: 0, skipped: 0 },
    }

    // First, fix variant names that are null
    const variantsWithoutName = await prisma.productVariant.findMany({
      where: {
        OR: [
          { name: null },
          { name: '' },
        ],
      },
      include: {
        optionValues: {
          include: {
            optionValue: {
              include: {
                optionType: true,
              },
            },
          },
          orderBy: {
            optionValue: {
              optionType: {
                displayOrder: 'asc',
              },
            },
          },
        },
      },
    })

    for (const variant of variantsWithoutName) {
      if (variant.optionValues.length === 0) {
        results.variantNames.skipped++
        continue
      }

      // Generate name from option values (e.g., "ขาว / L")
      const name = variant.optionValues
        .map((ov) => ov.optionValue.value)
        .join(' / ')

      if (name) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { name },
        })
        results.variantNames.fixed++
      } else {
        results.variantNames.skipped++
      }
    }

    // Fix stock balances
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

    for (const balance of stockBalances) {
      if (balance.product.variants.length === 0) {
        results.stockBalances.skipped++
        continue
      }

      // If product has exactly one variant, link it
      if (balance.product.variants.length === 1) {
        const variant = balance.product.variants[0]
        await prisma.stockBalance.update({
          where: { id: balance.id },
          data: { variantId: variant.id },
        })
        results.stockBalances.fixed++
        continue
      }

      // Try to match by product SKU = variant SKU
      const matchingVariant = balance.product.variants.find(
        (v) => v.sku === balance.product.sku
      )

      if (matchingVariant) {
        await prisma.stockBalance.update({
          where: { id: balance.id },
          data: { variantId: matchingVariant.id },
        })
        results.stockBalances.fixed++
      } else {
        results.stockBalances.skipped++
      }
    }

    // Fix movement lines
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

    for (const line of movementLines) {
      if (line.product.variants.length === 0) {
        results.movementLines.skipped++
        continue
      }

      if (line.product.variants.length === 1) {
        const variant = line.product.variants[0]
        await prisma.movementLine.update({
          where: { id: line.id },
          data: { variantId: variant.id },
        })
        results.movementLines.fixed++
        continue
      }

      const matchingVariant = line.product.variants.find(
        (v) => v.sku === line.product.sku
      )

      if (matchingVariant) {
        await prisma.movementLine.update({
          where: { id: line.id },
          data: { variantId: matchingVariant.id },
        })
        results.movementLines.fixed++
      } else {
        results.movementLines.skipped++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Stock variants fixed',
      results,
    })
  } catch (error) {
    console.error('Fix stock variants error:', error)
    return NextResponse.json(
      { error: 'Failed to fix stock variants' },
      { status: 500 }
    )
  }
}
