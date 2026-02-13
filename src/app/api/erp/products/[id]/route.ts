/**
 * ERP API - Single Product Endpoint
 * DELETE /api/erp/products/:id - Soft-delete a product
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Validate API key (same pattern as parent route)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Soft delete: set active=false and deletedAt
    await prisma.product.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: { id, sku: product.sku, deletedAt: new Date().toISOString() },
    })
  } catch (error) {
    console.error('ERP product delete error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
