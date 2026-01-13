/**
 * ERP API - Products Endpoint
 * GET /api/erp/products - Get all products with stock info
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Validate API key
async function validateApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('X-API-Key')
  
  if (!apiKey) return false

  try {
    const integration = await prisma.eRPIntegration.findFirst({
      where: {
        apiKey,
        active: true,
        provider: 'custom_erp',
      },
    })

    return !!integration
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!await validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const categoryCode = searchParams.get('category')
    const search = searchParams.get('search')
    const updatedAfter = searchParams.get('updated_after')

    const where: Record<string, unknown> = {
      active: true,
      deletedAt: null,
    }

    if (categoryCode) {
      where.category = { name: categoryCode }
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (updatedAfter) {
      where.updatedAt = { gte: new Date(updatedAfter) }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          unit: { select: { code: true, name: true } },
          stockBalances: {
            include: {
              location: {
                select: { code: true, name: true },
              },
            },
          },
          variants: {
            where: { active: true, deletedAt: null },
            select: {
              id: true,
              sku: true,
              barcode: true,
              name: true,
              costPrice: true,
              sellingPrice: true,
              stockBalances: {
                include: {
                  location: {
                    select: { code: true, name: true },
                  },
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { sku: 'asc' },
      }),
      prisma.product.count({ where }),
    ])

    const data = products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      barcode: product.barcode,
      category: product.category?.name || null,
      unit: product.unit?.code || null,
      unitName: product.unit?.name || null,
      standardCost: Number(product.standardCost),
      lastCost: Number(product.lastCost),
      reorderPoint: Number(product.reorderPoint),
      hasVariants: product.hasVariants,
      totalStock: product.stockBalances.reduce(
        (sum, sb) => sum + Number(sb.qtyOnHand),
        0
      ),
      stockByLocation: product.stockBalances.map((sb) => ({
        locationCode: sb.location.code,
        locationName: sb.location.name,
        qty: Number(sb.qtyOnHand),
      })),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        costPrice: Number(v.costPrice),
        sellingPrice: Number(v.sellingPrice),
        totalStock: v.stockBalances.reduce(
          (sum, sb) => sum + Number(sb.qtyOnHand),
          0
        ),
        stockByLocation: v.stockBalances.map((sb) => ({
          locationCode: sb.location.code,
          locationName: sb.location.name,
          qty: Number(sb.qtyOnHand),
        })),
      })),
      updatedAt: product.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        items: data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('ERP products error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
