import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GRNStatus } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 10
  const status = searchParams.get('status') as GRNStatus | null

  const where = {
    ...(status && { status }),
  }

  const [items, total] = await Promise.all([
    prisma.gRN.findMany({
      where,
      include: {
        po: {
          include: {
            supplier: {
              select: { name: true },
            },
          },
        },
        receivedBy: {
          select: { id: true, name: true, username: true },
        },
        lines: {
          select: { qtyReceived: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gRN.count({ where }),
  ])

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
