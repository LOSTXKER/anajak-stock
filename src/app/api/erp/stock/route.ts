/**
 * ERP API - Stock Endpoint
 * GET /api/erp/stock - Get current stock levels
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
    const locationCode = searchParams.get('location')
    const warehouseCode = searchParams.get('warehouse')
    const lowStockOnly = searchParams.get('low_stock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: Record<string, unknown> = {}

    if (locationCode) {
      where.location = { code: locationCode }
    }

    if (warehouseCode) {
      where.location = {
        ...((where.location as object) || {}),
        warehouse: { code: warehouseCode },
      }
    }

    const stockBalances = await prisma.stockBalance.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            barcode: true,
            reorderPoint: true,
            minQty: true,
            maxQty: true,
            active: true,
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            barcode: true,
            reorderPoint: true,
          },
        },
        location: {
          select: {
            code: true,
            name: true,
            warehouse: {
              select: { code: true, name: true },
            },
          },
        },
      },
      orderBy: [
        { product: { sku: 'asc' } },
        { location: { code: 'asc' } },
      ],
    })

    let data = stockBalances
      .filter((sb) => sb.product.active)
      .map((sb) => {
        const qty = Number(sb.qtyOnHand)
        const reorderPoint = sb.variant 
          ? Number(sb.variant.reorderPoint) 
          : Number(sb.product.reorderPoint)
        const isLowStock = reorderPoint > 0 && qty <= reorderPoint

        return {
          productId: sb.product.id,
          productSku: sb.product.sku,
          productName: sb.product.name,
          productBarcode: sb.product.barcode,
          variantId: sb.variant?.id || null,
          variantSku: sb.variant?.sku || null,
          variantName: sb.variant?.name || null,
          locationCode: sb.location.code,
          locationName: sb.location.name,
          warehouseCode: sb.location.warehouse.code,
          warehouseName: sb.location.warehouse.name,
          qty,
          reorderPoint,
          minQty: Number(sb.product.minQty),
          maxQty: Number(sb.product.maxQty),
          isLowStock,
        }
      })

    if (lowStockOnly) {
      data = data.filter((item) => item.isLowStock)
    }

    // Pagination
    const total = data.length
    const paginatedData = data.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedData,
        summary: {
          totalItems: total,
          lowStockCount: data.filter((i) => i.isLowStock).length,
          totalQty: data.reduce((sum, i) => sum + i.qty, 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('ERP stock error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
