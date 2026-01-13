'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ==================== TYPES ====================

type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string }

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

// ==================== OPTION TYPES ====================

export async function getOptionTypes() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
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

    return { success: true as const, data: optionTypes }
  } catch (error) {
    console.error('Get option types error:', error)
    return { success: false as const, error: 'ไม่สามารถดึงข้อมูลประเภทตัวเลือกได้' }
  }
}

export async function getOptionTypeById(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
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
      return { success: false as const, error: 'ไม่พบประเภทตัวเลือก' }
    }

    return { success: true as const, data: optionType }
  } catch (error) {
    console.error('Get option type by ID error:', error)
    return { success: false as const, error: 'ไม่สามารถดึงข้อมูลประเภทตัวเลือกได้' }
  }
}

export async function createOptionType(input: z.infer<typeof OptionTypeSchema>): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = OptionTypeSchema.parse(input)

    // Check for duplicate
    const existing = await prisma.optionType.findUnique({
      where: { name: validated.name },
    })

    if (existing) {
      return { success: false, error: 'ประเภทตัวเลือกนี้มีอยู่แล้ว' }
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

    return { success: true, data: { id: optionType.id } }
  } catch (error) {
    console.error('Create option type error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'ไม่สามารถสร้างประเภทตัวเลือกได้' }
  }
}

export async function updateOptionType(id: string, input: z.infer<typeof OptionTypeSchema>): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = OptionTypeSchema.parse(input)

    const existing = await prisma.optionType.findUnique({
      where: { id },
    })

    if (!existing) {
      return { success: false, error: 'ไม่พบประเภทตัวเลือก' }
    }

    // Check for duplicate name
    const duplicate = await prisma.optionType.findFirst({
      where: {
        name: validated.name,
        id: { not: id },
      },
    })

    if (duplicate) {
      return { success: false, error: 'ประเภทตัวเลือกนี้มีอยู่แล้ว' }
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

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update option type error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'ไม่สามารถอัปเดตประเภทตัวเลือกได้' }
  }
}

export async function deleteOptionType(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
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
      return { success: false, error: 'ไม่พบประเภทตัวเลือก' }
    }

    // Check if any values are in use
    const inUse = existing.values.some(v => v.variantOptions.length > 0)
    if (inUse) {
      return { success: false, error: 'ไม่สามารถลบได้ เนื่องจากมีสินค้าใช้ตัวเลือกนี้อยู่' }
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

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Delete option type error:', error)
    return { success: false, error: 'ไม่สามารถลบประเภทตัวเลือกได้' }
  }
}

// ==================== OPTION VALUES ====================

export async function createOptionValue(input: z.infer<typeof OptionValueSchema>): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = OptionValueSchema.parse(input)

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
      return { success: false, error: 'ค่าตัวเลือกนี้มีอยู่แล้ว' }
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

    return { success: true, data: { id: optionValue.id } }
  } catch (error) {
    console.error('Create option value error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'ไม่สามารถสร้างค่าตัวเลือกได้' }
  }
}

export async function updateOptionValue(id: string, input: Omit<z.infer<typeof OptionValueSchema>, 'optionTypeId'>): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const existing = await prisma.optionValue.findUnique({
      where: { id },
    })

    if (!existing) {
      return { success: false, error: 'ไม่พบค่าตัวเลือก' }
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
      return { success: false, error: 'ค่าตัวเลือกนี้มีอยู่แล้ว' }
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

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update option value error:', error)
    return { success: false, error: 'ไม่สามารถอัปเดตค่าตัวเลือกได้' }
  }
}

export async function deleteOptionValue(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const existing = await prisma.optionValue.findUnique({
      where: { id },
      include: {
        variantOptions: true,
      },
    })

    if (!existing) {
      return { success: false, error: 'ไม่พบค่าตัวเลือก' }
    }

    // Check if in use
    if (existing.variantOptions.length > 0) {
      return { success: false, error: 'ไม่สามารถลบได้ เนื่องจากมีสินค้าใช้ค่านี้อยู่' }
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

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Delete option value error:', error)
    return { success: false, error: 'ไม่สามารถลบค่าตัวเลือกได้' }
  }
}

export async function reorderOptionValues(optionTypeId: string, valueIds: string[]): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
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

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Reorder option values error:', error)
    return { success: false, error: 'ไม่สามารถจัดเรียงลำดับได้' }
  }
}
