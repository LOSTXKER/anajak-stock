'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { withAuth, handleActionError, validateInput, success, failure } from '@/lib/action-utils'
import { logError } from '@/lib/errors'
import type { ActionResult } from '@/types'

// ==================== SCHEMAS ====================

const CategoryInputSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหมวดหมู่'),
  description: z.string().optional(),
})

type CategoryInput = z.infer<typeof CategoryInputSchema>

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
    logError(error, { context: 'getCategories' })
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
    logError(error, { context: 'getCategoryById', id })
    return null
  }
}

// ==================== CREATE CATEGORY ====================

export const createCategory = withAuth<[CategoryInput], { id: string }>(
  async (session, input) => {
    const validation = validateInput(CategoryInputSchema, input)
    if (!validation.success) return validation

    const validated = validation.data

    // Check for duplicate name
    const existing = await prisma.category.findFirst({
      where: { 
        name: { equals: validated.name, mode: 'insensitive' },
        deletedAt: null,
      },
    })
    if (existing) {
      return failure('ชื่อหมวดหมู่นี้มีอยู่แล้ว')
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
    return success({ id: category.id })
  }
)

// ==================== UPDATE CATEGORY ====================

export const updateCategory = withAuth<[string, CategoryInput], void>(
  async (session, id, input) => {
    const validation = validateInput(CategoryInputSchema, input)
    if (!validation.success) return validation

    const validated = validation.data

    const existing = await prisma.category.findUnique({
      where: { id },
    })
    if (!existing) {
      return failure('ไม่พบหมวดหมู่')
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
      return failure('ชื่อหมวดหมู่นี้มีอยู่แล้ว')
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
    return success(undefined)
  }
)

// ==================== DELETE CATEGORY ====================

export const deleteCategory = withAuth<[string], void>(
  async (session, id) => {
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })
    if (!existing) {
      return failure('ไม่พบหมวดหมู่')
    }

    // Check if category has products
    if (existing._count.products > 0) {
      return failure(`ไม่สามารถลบหมวดหมู่ที่มีสินค้า ${existing._count.products} รายการได้`)
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
    return success(undefined)
  }
)
