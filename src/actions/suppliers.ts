'use server'

import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { withAuth, validateInput, success, failure } from '@/lib/action-utils'
import type { Supplier } from '@/generated/prisma'

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

export const getSuppliers = withAuth(async () => {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { pos: true },
      },
    },
  })

  return success(suppliers)
})

export const getSupplier = withAuth<[string], Supplier & { pos: unknown[]; _count: { pos: number } }>(
  async (_session, id) => {
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
      return failure('ไม่พบ Supplier')
    }

    return success(supplier)
  }
)

export const createSupplier = withAuth<[SupplierInput], Supplier>(
  async (_session, input) => {
    const validation = validateInput(SupplierSchema, input)
    if (!validation.success) return validation

    const validated = validation.data

    // Check for duplicate code
    const existing = await prisma.supplier.findFirst({
      where: { code: validated.code, deletedAt: null },
    })

    if (existing) {
      return failure('รหัส Supplier ซ้ำ')
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
    return success(supplier)
  }
)

export const updateSupplier = withAuth<[string, Partial<SupplierInput>], Supplier>(
  async (_session, id, input) => {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!supplier) {
      return failure('ไม่พบ Supplier')
    }

    // Check for duplicate code if changing
    if (input.code && input.code !== supplier.code) {
      const existing = await prisma.supplier.findFirst({
        where: { code: input.code, deletedAt: null, id: { not: id } },
      })
      if (existing) {
        return failure('รหัส Supplier ซ้ำ')
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
    return success(updated)
  }
)

export const deleteSupplier = withAuth<[string], void>(
  async (_session, id) => {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { pos: true },
        },
      },
    })

    if (!supplier) {
      return failure('ไม่พบ Supplier')
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
    return success(undefined)
  }
)

export const toggleSupplierStatus = withAuth<[string], Supplier>(
  async (_session, id) => {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!supplier) {
      return failure('ไม่พบ Supplier')
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: { active: !supplier.active },
    })

    revalidatePath('/suppliers')
    revalidatePath(`/suppliers/${id}`)
    return success(updated)
  }
)
