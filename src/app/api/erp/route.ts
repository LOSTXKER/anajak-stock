/**
 * ERP API Endpoints
 * 
 * These endpoints are designed for external ERP/Factory systems to integrate with
 * the inventory management system.
 * 
 * All requests require an API key in the header: X-API-Key
 * 
 * Available endpoints:
 * - GET  /api/erp/products    - Get product list with stock
 * - GET  /api/erp/stock       - Get current stock levels
 * - POST /api/erp/movements   - Create stock movements
 * - GET  /api/erp/movements   - Get recent movements
 * - POST /api/erp/receive     - Receive stock (from production)
 * - POST /api/erp/issue       - Issue stock (for production)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { validateApiKey, errorResponse, unauthorizedResponse, rateLimitedResponse } from '@/lib/api-auth'

// GET /api/erp - API info
export async function GET(request: NextRequest) {
  const { valid, rateLimited } = await validateApiKey(request)
  if (rateLimited) return rateLimitedResponse()
  if (!valid) return unauthorizedResponse()

  return NextResponse.json({
    success: true,
    data: {
      name: 'Inventory Management ERP API',
      version: '1.0.0',
      endpoints: [
        { method: 'GET', path: '/api/erp/products', description: 'Get product list with stock' },
        { method: 'GET', path: '/api/erp/stock', description: 'Get current stock levels' },
        { method: 'GET', path: '/api/erp/stock/:sku', description: 'Get stock for specific product' },
        { method: 'POST', path: '/api/erp/movements', description: 'Create stock movement' },
        { method: 'GET', path: '/api/erp/movements', description: 'Get recent movements' },
        { method: 'POST', path: '/api/erp/receive', description: 'Receive stock (from production)' },
        { method: 'POST', path: '/api/erp/issue', description: 'Issue stock (for production)' },
      ],
    },
  })
}

// POST /api/erp - Webhook receiver
export async function POST(request: NextRequest) {
  const { valid, integrationId, rateLimited } = await validateApiKey(request)
  if (rateLimited) return rateLimitedResponse()
  if (!valid) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'sync_product':
        return handleSyncProduct(data, integrationId!)
      case 'sync_stock':
        return handleSyncStock(data, integrationId!)
      case 'create_movement':
        return handleCreateMovement(data, integrationId!)
      default:
        return errorResponse(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('ERP API error:', error)
    return errorResponse('Internal server error', 500)
  }
}

// Handle product sync from ERP
async function handleSyncProduct(
  data: {
    sku: string
    name: string
    description?: string
    categoryCode?: string
    unitCode?: string
    cost?: number
  },
  integrationId: string
) {
  try {
    // Find or create product
    let product = await prisma.product.findUnique({
      where: { sku: data.sku },
    })

    const updateData = {
      name: data.name,
      description: data.description,
      lastCost: data.cost || 0,
    }

    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: updateData,
      })
    } else {
      product = await prisma.product.create({
        data: {
          sku: data.sku,
          ...updateData,
        },
      })
    }

    // Log the sync
    await prisma.eRPSyncLog.create({
      data: {
        integrationId,
        direction: 'IN',
        docType: 'PRODUCT',
        localId: product.id,
        externalId: data.sku,
        status: 'SUCCESS',
        requestData: data as object,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: product.id,
        sku: product.sku,
        name: product.name,
      },
    })
  } catch (error) {
    console.error('Sync product error:', error)
    return errorResponse('Failed to sync product', 500)
  }
}

// Handle stock sync from ERP
async function handleSyncStock(
  data: {
    sku: string
    locationCode: string
    qty: number
    lotNumber?: string
  },
  integrationId: string
) {
  try {
    // Find product
    const product = await prisma.product.findUnique({
      where: { sku: data.sku },
    })

    if (!product) {
      return errorResponse(`Product not found: ${data.sku}`, 404)
    }

    // Find location
    const location = await prisma.location.findFirst({
      where: { code: data.locationCode },
    })

    if (!location) {
      return errorResponse(`Location not found: ${data.locationCode}`, 404)
    }

    // Upsert stock balance
    const stockBalance = await prisma.stockBalance.upsert({
      where: {
        productId_variantId_locationId: {
          productId: product.id,
          variantId: Prisma.DbNull as unknown as string,
          locationId: location.id,
        },
      },
      update: {
        qtyOnHand: data.qty,
      },
      create: {
        productId: product.id,
        locationId: location.id,
        qtyOnHand: data.qty,
      },
    })

    // Log the sync
    await prisma.eRPSyncLog.create({
      data: {
        integrationId,
        direction: 'IN',
        docType: 'STOCK',
        localId: stockBalance.id,
        status: 'SUCCESS',
        requestData: data as object,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        productId: product.id,
        sku: data.sku,
        locationCode: data.locationCode,
        qty: Number(stockBalance.qtyOnHand),
      },
    })
  } catch (error) {
    console.error('Sync stock error:', error)
    return errorResponse('Failed to sync stock', 500)
  }
}

// Handle movement creation from ERP
async function handleCreateMovement(
  data: {
    type: 'RECEIVE' | 'ISSUE' | 'ADJUST'
    refNo?: string
    note?: string
    lines: {
      sku: string
      locationCode: string
      qty: number
      unitCost?: number
      lotNumber?: string
    }[]
  },
  integrationId: string
) {
  try {
    // Get or create a system user for ERP movements
    let systemUser = await prisma.user.findFirst({
      where: { username: 'erp_system' },
    })

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          username: 'erp_system',
          name: 'ERP System',
          role: 'ADMIN',
          active: true,
        },
      })
    }

    // Generate document number
    const docSeq = await prisma.docSequence.findUnique({
      where: { docType: 'MOVEMENT' },
    })

    const nextNo = (docSeq?.currentNo || 0) + 1
    const docNumber = `ERP-${String(nextNo).padStart(6, '0')}`

    // Validate and prepare lines
    const preparedLines = []
    for (const line of data.lines) {
      const product = await prisma.product.findUnique({
        where: { sku: line.sku },
      })

      if (!product) {
        return errorResponse(`Product not found: ${line.sku}`, 404)
      }

      const location = await prisma.location.findFirst({
        where: { code: line.locationCode },
      })

      if (!location) {
        return errorResponse(`Location not found: ${line.locationCode}`, 404)
      }

      preparedLines.push({
        productId: product.id,
        locationId: location.id,
        qty: line.qty,
        unitCost: line.unitCost || 0,
      })
    }

    // Create movement
    const movement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: data.type,
        refType: 'ERP',
        refId: data.refNo,
        status: 'POSTED',
        note: data.note,
        createdById: systemUser.id,
        postedAt: new Date(),
        lines: {
          create: preparedLines.map((line) => ({
            productId: line.productId,
            toLocationId: data.type === 'RECEIVE' ? line.locationId : undefined,
            fromLocationId: data.type === 'ISSUE' ? line.locationId : undefined,
            qty: line.qty,
            unitCost: line.unitCost,
          })),
        },
      },
      include: {
        lines: true,
      },
    })

    // Update stock balances
    for (const line of preparedLines) {
      const qtyChange = data.type === 'RECEIVE' ? line.qty : -line.qty

      await prisma.stockBalance.upsert({
        where: {
          productId_variantId_locationId: {
            productId: line.productId,
            variantId: Prisma.DbNull as unknown as string,
            locationId: line.locationId,
          },
        },
        update: {
          qtyOnHand: { increment: qtyChange },
        },
        create: {
          productId: line.productId,
          locationId: line.locationId,
          qtyOnHand: qtyChange,
        },
      })
    }

    // Update doc sequence
    await prisma.docSequence.upsert({
      where: { docType: 'MOVEMENT' },
      update: { currentNo: nextNo },
      create: { docType: 'MOVEMENT', prefix: 'ERP-', currentNo: nextNo },
    })

    // Log the sync
    await prisma.eRPSyncLog.create({
      data: {
        integrationId,
        direction: 'IN',
        docType: 'MOVEMENT',
        localId: movement.id,
        externalId: data.refNo,
        status: 'SUCCESS',
        requestData: data as object,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: movement.id,
        docNumber: movement.docNumber,
        type: movement.type,
        linesCount: movement.lines.length,
      },
    })
  } catch (error) {
    console.error('Create movement error:', error)
    return errorResponse('Failed to create movement', 500)
  }
}
