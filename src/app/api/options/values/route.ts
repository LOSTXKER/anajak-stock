import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { optionTypeId, optionTypeName, value } = await request.json()

    if (!value) {
      return NextResponse.json(
        { error: 'value is required' },
        { status: 400 }
      )
    }

    if (!optionTypeId && !optionTypeName) {
      return NextResponse.json(
        { error: 'optionTypeId or optionTypeName is required' },
        { status: 400 }
      )
    }

    let resolvedOptionTypeId = optionTypeId

    // If optionTypeName is provided, find or create the option type
    if (!resolvedOptionTypeId && optionTypeName) {
      let optionType = await prisma.optionType.findUnique({
        where: { name: optionTypeName },
      })

      if (!optionType) {
        // Create new option type
        optionType = await prisma.optionType.create({
          data: { name: optionTypeName },
        })
      }

      resolvedOptionTypeId = optionType.id
    }

    // Check if option type exists (if using optionTypeId directly)
    if (optionTypeId) {
      const optionType = await prisma.optionType.findUnique({
        where: { id: optionTypeId },
      })
      if (!optionType) {
        return NextResponse.json(
          { error: 'Option type not found' },
          { status: 404 }
        )
      }
    }

    // Check if value already exists
    const existing = await prisma.optionValue.findFirst({
      where: {
        optionTypeId: resolvedOptionTypeId,
        value: { equals: value, mode: 'insensitive' },
      },
    })
    if (existing) {
      return NextResponse.json(existing)
    }

    // Create new option value
    const optionValue = await prisma.optionValue.create({
      data: {
        optionTypeId: resolvedOptionTypeId,
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
