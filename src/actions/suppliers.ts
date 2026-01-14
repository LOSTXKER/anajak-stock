'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// ==================== SCHEMAS ====================

const SupplierSchema = z.object({
  code: z.string().min(1, 'กรุณาระบุรหัส'),
  name: z.string().min(1, 'กรุณาระบุชื่อ'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  terms: z.string().optional(),
  leadTimeDays: z.number().min(0).optional(),
  active: z.boolean().default(true),
})

type SupplierInput = z.infer<typeof SupplierSchema>

// ==================== ACTIONS ====================

export async function getSuppliers() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { pos: true },
        },
      },
    })

    return { success: true as const, data: suppliers }
  } catch (error) {
    console.error('Error getting suppliers:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function getSupplier(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        pos: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            _count: {
              select: { lines: true },
            },
          },
        },
        _count: {
          select: { pos: true },
        },
      },
    })

    if (!supplier) {
      return { success: false as const, error: 'ไม่พบ Supplier' }
    }

    return { success: true as const, data: supplier }
  } catch (error) {
    console.error('Error getting supplier:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function createSupplier(input: SupplierInput) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const validated = SupplierSchema.parse(input)

    // Check for duplicate code
    const existing = await prisma.supplier.findFirst({
      where: { code: validated.code, deletedAt: null },
    })

    if (existing) {
      return { success: false as const, error: 'รหัส Supplier ซ้ำ' }
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: validated.code,
        name: validated.name,
        contactName: validated.contactName || null,
        phone: validated.phone || null,
        email: validated.email || null,
        address: validated.address || null,
        taxId: validated.taxId || null,
        terms: validated.terms || null,
        leadTimeDays: validated.leadTimeDays || null,
        active: validated.active,
      },
    })

    revalidatePath('/suppliers')
    return { success: true as const, data: supplier }
  } catch (error) {
    console.error('Error creating supplier:', error)
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0].message }
    }
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการสร้าง Supplier' }
  }
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!supplier) {
      return { success: false as const, error: 'ไม่พบ Supplier' }
    }

    // Check for duplicate code if changing
    if (input.code && input.code !== supplier.code) {
      const existing = await prisma.supplier.findFirst({
        where: { code: input.code, deletedAt: null, id: { not: id } },
      })
      if (existing) {
        return { success: false as const, error: 'รหัส Supplier ซ้ำ' }
      }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        contactName: input.contactName ?? undefined,
        phone: input.phone ?? undefined,
        email: input.email || null,
        address: input.address ?? undefined,
        taxId: input.taxId ?? undefined,
        terms: input.terms ?? undefined,
        leadTimeDays: input.leadTimeDays ?? undefined,
        active: input.active,
      },
    })

    revalidatePath('/suppliers')
    revalidatePath(`/suppliers/${id}`)
    return { success: true as const, data: updated }
  } catch (error) {
    console.error('Error updating supplier:', error)
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0].message }
    }
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการอัปเดต Supplier' }
  }
}

export async function deleteSupplier(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { pos: true },
        },
      },
    })

    if (!supplier) {
      return { success: false as const, error: 'ไม่พบ Supplier' }
    }

    if (supplier._count.pos > 0) {
      // Soft delete if has POs
      await prisma.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      })
    } else {
      // Hard delete if no POs
      await prisma.supplier.delete({
        where: { id },
      })
    }

    revalidatePath('/suppliers')
    return { success: true as const, data: undefined }
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการลบ Supplier' }
  }
}

export async function toggleSupplierStatus(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!supplier) {
      return { success: false as const, error: 'ไม่พบ Supplier' }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: { active: !supplier.active },
    })

    revalidatePath('/suppliers')
    revalidatePath(`/suppliers/${id}`)
    return { success: true as const, data: updated }
  } catch (error) {
    console.error('Error toggling supplier status:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}
