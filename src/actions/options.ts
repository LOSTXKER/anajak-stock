'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { withAuth, validateInput, success, failure } from '@/lib/action-utils'
import type { OptionType, OptionValue } from '@/generated/prisma'

// ==================== SCHEMAS ====================

const OptionTypeSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อประเภทตัวเลือก'),
  displayOrder: z.number().int().default(0),
})

const OptionValueSchema = z.object({
  optionTypeId: z.string().min(1, 'กรุณาเลือกประเภทตัวเลือก'),
  value: z.string().min(1, 'กรุณากรอกค่าตัวเลือก'),
  displayOrder: z.number().int().default(0),
})

type OptionTypeInput = z.infer<typeof OptionTypeSchema>
type OptionValueInput = z.infer<typeof OptionValueSchema>

// ==================== OPTION TYPES ====================

export const getOptionTypes = withAuth(async () => {
  const optionTypes = await prisma.optionType.findMany({
    where: { active: true },
    include: {
      values: {
        where: { active: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
    orderBy: { displayOrder: 'asc' },
  })

  return success(optionTypes)
})

export const getOptionTypeById = withAuth<[string], OptionType & { values: OptionValue[] }>(
  async (_session, id) => {
    const optionType = await prisma.optionType.findUnique({
      where: { id },
      include: {
        values: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    if (!optionType) {
      return failure('ไม่พบประเภทตัวเลือก')
    }

    return success(optionType)
  }
)

export const createOptionType = withAuth<[OptionTypeInput], { id: string }>(
  async (session, input) => {
    const validation = validateInput(OptionTypeSchema, input)
    if (!validation.success) return validation

    const validated = validation.data

    // Check for duplicate
    const existing = await prisma.optionType.findUnique({
      where: { name: validated.name },
    })

    if (existing) {
      return failure('ประเภทตัวเลือกนี้มีอยู่แล้ว')
    }

    const optionType = await prisma.optionType.create({
      data: validated,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'OPTION_TYPE',
        refId: optionType.id,
        newData: validated,
      },
    })

    revalidatePath('/settings/options')
    return success({ id: optionType.id })
  }
)

export const updateOptionType = withAuth<[string, OptionTypeInput], void>(
  async (session, id, input) => {
    const validation = validateInput(OptionTypeSchema, input)
    if (!validation.success) return validation

    const validated = validation.data

    const existing = await prisma.optionType.findUnique({
      where: { id },
    })

    if (!existing) {
      return failure('ไม่พบประเภทตัวเลือก')
    }

    // Check for duplicate name
    const duplicate = await prisma.optionType.findFirst({
      where: {
        name: validated.name,
        id: { not: id },
      },
    })

    if (duplicate) {
      return failure('ประเภทตัวเลือกนี้มีอยู่แล้ว')
    }

    await prisma.optionType.update({
      where: { id },
      data: validated,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'OPTION_TYPE',
        refId: id,
        oldData: existing,
        newData: validated,
      },
    })

    revalidatePath('/settings/options')
    return success(undefined)
  }
)

export const deleteOptionType = withAuth<[string], void>(
  async (session, id) => {
    const existing = await prisma.optionType.findUnique({
      where: { id },
      include: {
        values: {
          include: {
            variantOptions: true,
          },
        },
      },
    })

    if (!existing) {
      return failure('ไม่พบประเภทตัวเลือก')
    }

    // Check if any values are in use
    const inUse = existing.values.some(v => v.variantOptions.length > 0)
    if (inUse) {
      return failure('ไม่สามารถลบได้ เนื่องจากมีสินค้าใช้ตัวเลือกนี้อยู่')
    }

    // Soft delete
    await prisma.optionType.update({
      where: { id },
      data: { active: false },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'OPTION_TYPE',
        refId: id,
        oldData: existing,
      },
    })

    revalidatePath('/settings/options')
    return success(undefined)
  }
)

// ==================== OPTION VALUES ====================

export const createOptionValue = withAuth<[OptionValueInput], { id: string }>(
  async (session, input) => {
    const validation = validateInput(OptionValueSchema, input)
    if (!validation.success) return validation

    const validated = validation.data

    // Check for duplicate
    const existing = await prisma.optionValue.findUnique({
      where: {
        optionTypeId_value: {
          optionTypeId: validated.optionTypeId,
          value: validated.value,
        },
      },
    })

    if (existing) {
      return failure('ค่าตัวเลือกนี้มีอยู่แล้ว')
    }

    const optionValue = await prisma.optionValue.create({
      data: validated,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'OPTION_VALUE',
        refId: optionValue.id,
        newData: validated,
      },
    })

    revalidatePath('/settings/options')
    return success({ id: optionValue.id })
  }
)

export const updateOptionValue = withAuth<[string, Omit<OptionValueInput, 'optionTypeId'>], void>(
  async (session, id, input) => {
    const existing = await prisma.optionValue.findUnique({
      where: { id },
    })

    if (!existing) {
      return failure('ไม่พบค่าตัวเลือก')
    }

    // Check for duplicate
    const duplicate = await prisma.optionValue.findFirst({
      where: {
        optionTypeId: existing.optionTypeId,
        value: input.value,
        id: { not: id },
      },
    })

    if (duplicate) {
      return failure('ค่าตัวเลือกนี้มีอยู่แล้ว')
    }

    await prisma.optionValue.update({
      where: { id },
      data: input,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'OPTION_VALUE',
        refId: id,
        oldData: existing,
        newData: input,
      },
    })

    revalidatePath('/settings/options')
    return success(undefined)
  }
)

export const deleteOptionValue = withAuth<[string], void>(
  async (session, id) => {
    const existing = await prisma.optionValue.findUnique({
      where: { id },
      include: {
        variantOptions: true,
      },
    })

    if (!existing) {
      return failure('ไม่พบค่าตัวเลือก')
    }

    // Check if in use
    if (existing.variantOptions.length > 0) {
      return failure('ไม่สามารถลบได้ เนื่องจากมีสินค้าใช้ค่านี้อยู่')
    }

    // Soft delete
    await prisma.optionValue.update({
      where: { id },
      data: { active: false },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'OPTION_VALUE',
        refId: id,
        oldData: existing,
      },
    })

    revalidatePath('/settings/options')
    return success(undefined)
  }
)

export const reorderOptionValues = withAuth<[string, string[]], void>(
  async (_session, _optionTypeId, valueIds) => {
    // Update display order for each value
    await prisma.$transaction(
      valueIds.map((id, index) =>
        prisma.optionValue.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    )

    revalidatePath('/settings/options')
    return success(undefined)
  }
)
