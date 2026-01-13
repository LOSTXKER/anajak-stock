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

const CategoryInputSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหมวดหมู่'),
  description: z.string().optional(),
})

// ==================== GET CATEGORIES ====================

export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })
    return categories
  } catch (error) {
    console.error('Get categories error:', error)
    return []
  }
}

export async function getCategoryById(id: string) {
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })
    return category
  } catch (error) {
    console.error('Get category by id error:', error)
    return null
  }
}

// ==================== CREATE CATEGORY ====================

export async function createCategory(
  input: z.infer<typeof CategoryInputSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = CategoryInputSchema.parse(input)

    // Check for duplicate name
    const existing = await prisma.category.findFirst({
      where: { 
        name: { equals: validated.name, mode: 'insensitive' },
        deletedAt: null,
      },
    })
    if (existing) {
      return { success: false, error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' }
    }

    const category = await prisma.category.create({
      data: {
        name: validated.name,
        description: validated.description,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'CATEGORY',
        refId: category.id,
        newData: validated,
      },
    })

    revalidatePath('/settings/categories')
    return { success: true, data: { id: category.id } }
  } catch (error) {
    console.error('Create category error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'ไม่สามารถสร้างหมวดหมู่ได้' }
  }
}

// ==================== UPDATE CATEGORY ====================

export async function updateCategory(
  id: string,
  input: z.infer<typeof CategoryInputSchema>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const validated = CategoryInputSchema.parse(input)

    const existing = await prisma.category.findUnique({
      where: { id },
    })
    if (!existing) {
      return { success: false, error: 'ไม่พบหมวดหมู่' }
    }

    // Check for duplicate name (excluding current)
    const duplicate = await prisma.category.findFirst({
      where: { 
        name: { equals: validated.name, mode: 'insensitive' },
        id: { not: id },
        deletedAt: null,
      },
    })
    if (duplicate) {
      return { success: false, error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' }
    }

    await prisma.category.update({
      where: { id },
      data: {
        name: validated.name,
        description: validated.description,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'CATEGORY',
        refId: id,
        oldData: existing,
        newData: validated,
      },
    })

    revalidatePath('/settings/categories')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update category error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'ไม่สามารถอัปเดตหมวดหมู่ได้' }
  }
}

// ==================== DELETE CATEGORY ====================

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })
    if (!existing) {
      return { success: false, error: 'ไม่พบหมวดหมู่' }
    }

    // Check if category has products
    if (existing._count.products > 0) {
      return { success: false, error: `ไม่สามารถลบหมวดหมู่ที่มีสินค้า ${existing._count.products} รายการได้` }
    }

    // Soft delete
    await prisma.category.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'CATEGORY',
        refId: id,
        oldData: existing,
      },
    })

    revalidatePath('/settings/categories')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Delete category error:', error)
    return { success: false, error: 'ไม่สามารถลบหมวดหมู่ได้' }
  }
}
