/**
 * ERP API - Single Product Endpoint
 * DELETE /api/erp/products/:id - Soft-delete a product
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse, rateLimitedResponse } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { valid, rateLimited } = await validateApiKey(request)
  if (rateLimited) return rateLimitedResponse()
  if (!valid) return unauthorizedResponse()

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
