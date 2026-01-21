import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active products (without variants for simple products)
    const products = await prisma.product.findMany({
      where: {
        active: true,
        deletedAt: null,
        hasVariants: false, // Only simple products
      },
      select: {
        id: true,
        sku: true,
        name: true,
        stockType: true,
        hasVariants: true,
        category: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Get all active variants
    const variants = await prisma.productVariant.findMany({
      where: {
        active: true,
        deletedAt: null,
        product: {
          active: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        name: true,
        stockType: true,
        product: {
          select: { name: true },
        },
        optionValues: {
          select: {
            optionValue: {
              select: {
                value: true,
                optionType: {
                  select: { displayOrder: true },
                },
              },
            },
          },
          orderBy: {
            optionValue: { optionType: { displayOrder: 'asc' } },
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { sku: 'asc' },
      ],
    })

    return NextResponse.json({
      products: products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stockType: p.stockType,
        hasVariants: p.hasVariants,
        category: p.category?.name || null,
      })),
      variants: variants.map(v => ({
        id: v.id,
        productId: v.productId,
        productName: v.product.name,
        sku: v.sku,
        name: v.name,
        stockType: v.stockType,
        options: v.optionValues.map(ov => ov.optionValue.value).join(' / '),
      })),
    })
  } catch (error) {
    console.error('Bulk stock type API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
