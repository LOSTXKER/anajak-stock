import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { serialize } from '@/lib/serialize'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        productId: id,
        active: true,
        deletedAt: null,
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
        },
        stockBalances: {
          select: {
            qtyOnHand: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Serialize to convert Decimal to number for client components
    return NextResponse.json(serialize(variants))
  } catch (error) {
    console.error('Error fetching variants:', error)
    return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 })
  }
}
