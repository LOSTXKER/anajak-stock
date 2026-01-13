/**
 * ERP API - Movements Endpoint
 * GET /api/erp/movements - Get recent stock movements
 * POST /api/erp/movements - Create a new stock movement
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'

// Validate API key and get integration ID
async function validateApiKey(request: NextRequest): Promise<{ valid: boolean; integrationId?: string }> {
  const apiKey = request.headers.get('X-API-Key')
  
  if (!apiKey) return { valid: false }

  try {
    const integration = await prisma.eRPIntegration.findFirst({
      where: {
        apiKey,
        active: true,
        provider: 'custom_erp',
      },
    })

    return integration ? { valid: true, integrationId: integration.id } : { valid: false }
  } catch {
    return { valid: false }
  }
}

export async function GET(request: NextRequest) {
  const { valid } = await validateApiKey(request)
  
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'RECEIVE' | 'ISSUE' | 'TRANSFER' | 'ADJUST' | null
    const status = searchParams.get('status') as 'DRAFT' | 'POSTED' | 'CANCELLED' | null
    const fromDate = searchParams.get('from_date')
    const toDate = searchParams.get('to_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(fromDate)
      }
      if (toDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(toDate)
      }
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          createdBy: { select: { name: true } },
          lines: {
            include: {
              product: { select: { sku: true, name: true } },
              variant: { select: { sku: true, name: true } },
              fromLocation: { select: { code: true, name: true } },
              toLocation: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ])

    const data = movements.map((m) => ({
      id: m.id,
      docNumber: m.docNumber,
      type: m.type,
      status: m.status,
      refType: m.refType,
      refId: m.refId,
      note: m.note,
      reason: m.reason,
      createdBy: m.createdBy.name,
      createdAt: m.createdAt.toISOString(),
      postedAt: m.postedAt?.toISOString() || null,
      lines: m.lines.map((l) => ({
        productSku: l.product.sku,
        productName: l.product.name,
        variantSku: l.variant?.sku || null,
        variantName: l.variant?.name || null,
        fromLocation: l.fromLocation?.code || null,
        toLocation: l.toLocation?.code || null,
        qty: Number(l.qty),
        unitCost: Number(l.unitCost),
      })),
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
    console.error('ERP movements error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { valid, integrationId } = await validateApiKey(request)
  
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { type, refNo, note, reason, lines } = body

    // Validate type
    if (!['RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUST'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid movement type' },
        { status: 400 }
      )
    }

    // Validate lines
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lines are required' },
        { status: 400 }
      )
    }

    // Get or create system user
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
    for (const line of lines) {
      // Find product by SKU
      const product = await prisma.product.findUnique({
        where: { sku: line.sku },
      })

      if (!product) {
        return NextResponse.json(
          { success: false, error: `Product not found: ${line.sku}` },
          { status: 404 }
        )
      }

      // Find locations
      let fromLocation = null
      let toLocation = null

      if (line.fromLocation) {
        fromLocation = await prisma.location.findFirst({
          where: { code: line.fromLocation },
        })
        if (!fromLocation) {
          return NextResponse.json(
            { success: false, error: `From location not found: ${line.fromLocation}` },
            { status: 404 }
          )
        }
      }

      if (line.toLocation) {
        toLocation = await prisma.location.findFirst({
          where: { code: line.toLocation },
        })
        if (!toLocation) {
          return NextResponse.json(
            { success: false, error: `To location not found: ${line.toLocation}` },
            { status: 404 }
          )
        }
      }

      // Validate location based on type
      if (type === 'RECEIVE' && !toLocation) {
        return NextResponse.json(
          { success: false, error: 'toLocation is required for RECEIVE' },
          { status: 400 }
        )
      }

      if (type === 'ISSUE' && !fromLocation) {
        return NextResponse.json(
          { success: false, error: 'fromLocation is required for ISSUE' },
          { status: 400 }
        )
      }

      if (type === 'TRANSFER' && (!fromLocation || !toLocation)) {
        return NextResponse.json(
          { success: false, error: 'Both fromLocation and toLocation are required for TRANSFER' },
          { status: 400 }
        )
      }

      preparedLines.push({
        productId: product.id,
        fromLocationId: fromLocation?.id,
        toLocationId: toLocation?.id,
        qty: Number(line.qty),
        unitCost: Number(line.unitCost || 0),
        note: line.note,
      })
    }

    // Create movement
    const movement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type,
        refType: 'ERP',
        refId: refNo,
        status: 'POSTED',
        note,
        reason,
        createdById: systemUser.id,
        postedAt: new Date(),
        lines: {
          create: preparedLines,
        },
      },
      include: {
        lines: true,
      },
    })

    // Update stock balances
    for (const line of preparedLines) {
      // Decrease from source (for ISSUE, TRANSFER)
      if (line.fromLocationId) {
        await prisma.stockBalance.upsert({
          where: {
            productId_variantId_locationId: {
              productId: line.productId,
              variantId: Prisma.DbNull as unknown as string,
              locationId: line.fromLocationId,
            },
          },
          update: {
            qtyOnHand: { decrement: line.qty },
          },
          create: {
            productId: line.productId,
            locationId: line.fromLocationId,
            qtyOnHand: -line.qty,
          },
        })
      }

      // Increase at destination (for RECEIVE, TRANSFER)
      if (line.toLocationId) {
        await prisma.stockBalance.upsert({
          where: {
            productId_variantId_locationId: {
              productId: line.productId,
              variantId: Prisma.DbNull as unknown as string,
              locationId: line.toLocationId,
            },
          },
          update: {
            qtyOnHand: { increment: line.qty },
          },
          create: {
            productId: line.productId,
            locationId: line.toLocationId,
            qtyOnHand: line.qty,
          },
        })
      }
    }

    // Update doc sequence
    await prisma.docSequence.upsert({
      where: { docType: 'MOVEMENT' },
      update: { currentNo: nextNo },
      create: { docType: 'MOVEMENT', prefix: 'ERP-', currentNo: nextNo },
    })

    // Log the sync
    if (integrationId) {
      await prisma.eRPSyncLog.create({
        data: {
          integrationId,
          direction: 'IN',
          docType: 'MOVEMENT',
          localId: movement.id,
          externalId: refNo,
          status: 'SUCCESS',
          requestData: body as object,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: movement.id,
        docNumber: movement.docNumber,
        type: movement.type,
        status: movement.status,
        linesCount: movement.lines.length,
        createdAt: movement.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('ERP create movement error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
