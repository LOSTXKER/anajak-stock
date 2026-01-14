import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { optionTypeId, value } = await request.json()

    if (!optionTypeId || !value) {
      return NextResponse.json(
        { error: 'optionTypeId and value are required' },
        { status: 400 }
      )
    }

    // Check if option type exists
    const optionType = await prisma.optionType.findUnique({
      where: { id: optionTypeId },
    })
    if (!optionType) {
      return NextResponse.json(
        { error: 'Option type not found' },
        { status: 404 }
      )
    }

    // Check if value already exists
    const existing = await prisma.optionValue.findFirst({
      where: {
        optionTypeId,
        value: { equals: value, mode: 'insensitive' },
      },
    })
    if (existing) {
      return NextResponse.json(existing)
    }

    // Create new option value
    const optionValue = await prisma.optionValue.create({
      data: {
        optionTypeId,
        value,
      },
    })

    return NextResponse.json(optionValue)
  } catch (error) {
    console.error('Error creating option value:', error)
    return NextResponse.json(
      { error: 'Failed to create option value' },
      { status: 500 }
    )
  }
}
