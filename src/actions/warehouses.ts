'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types'

// Schemas
const warehouseSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัสคลัง'),
  name: z.string().min(1, 'กรุณากรอกชื่อคลัง'),
  address: z.string().optional(),
})

const locationSchema = z.object({
  warehouseId: z.string().min(1, 'กรุณาเลือกคลัง'),
  code: z.string().min(1, 'กรุณากรอกรหัสตำแหน่ง'),
  name: z.string().min(1, 'กรุณากรอกชื่อตำแหน่ง'),
  zone: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
})

// Types
export interface WarehouseWithLocations {
  id: string
  code: string
  name: string
  address: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
  locations: LocationData[]
  _count: {
    locations: number
  }
}

export interface LocationData {
  id: string
  warehouseId: string
  code: string
  name: string
  zone: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  active: boolean
  warehouse?: {
    id: string
    name: string
  }
  _count?: {
    stockBalances: number
  }
}

// ==================== WAREHOUSE ACTIONS ====================

export async function getWarehouses(): Promise<WarehouseWithLocations[]> {
  const warehouses = await prisma.warehouse.findMany({
    where: { deletedAt: null },
    include: {
      locations: {
        where: { deletedAt: null },
        orderBy: { code: 'asc' },
      },
      _count: {
        select: { locations: true },
      },
    },
    orderBy: { code: 'asc' },
  })

  return warehouses as WarehouseWithLocations[]
}

export async function getWarehouse(id: string): Promise<WarehouseWithLocations | null> {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      locations: {
        where: { deletedAt: null },
        include: {
          _count: {
            select: { stockBalances: true },
          },
        },
        orderBy: { code: 'asc' },
      },
      _count: {
        select: { locations: true },
      },
    },
  })

  return warehouse as WarehouseWithLocations | null
}

export async function createWarehouse(data: z.infer<typeof warehouseSchema>): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  const validation = warehouseSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  // Check duplicate code
  const existing = await prisma.warehouse.findUnique({
    where: { code: data.code },
  })
  if (existing) {
    return { success: false, error: 'รหัสคลังนี้มีอยู่แล้ว' }
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      code: data.code,
      name: data.name,
      address: data.address || null,
    },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: { id: warehouse.id } }
}

export async function updateWarehouse(
  id: string,
  data: z.infer<typeof warehouseSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  const validation = warehouseSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  // Check duplicate code (exclude self)
  const existing = await prisma.warehouse.findFirst({
    where: {
      code: data.code,
      id: { not: id },
    },
  })
  if (existing) {
    return { success: false, error: 'รหัสคลังนี้มีอยู่แล้ว' }
  }

  await prisma.warehouse.update({
    where: { id },
    data: {
      code: data.code,
      name: data.name,
      address: data.address || null,
    },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: { id } }
}

export async function deleteWarehouse(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  // Check if has locations with stock
  const locationsWithStock = await prisma.location.count({
    where: {
      warehouseId: id,
      stockBalances: { some: { qtyOnHand: { gt: 0 } } },
    },
  })

  if (locationsWithStock > 0) {
    return { success: false, error: 'ไม่สามารถลบได้ เพราะมีสต๊อคอยู่ในคลังนี้' }
  }

  // Soft delete warehouse and its locations
  await prisma.$transaction([
    prisma.location.updateMany({
      where: { warehouseId: id },
      data: { deletedAt: new Date(), active: false },
    }),
    prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    }),
  ])

  revalidatePath('/settings/warehouses')
  return { success: true, data: undefined }
}

export async function toggleWarehouseActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  await prisma.warehouse.update({
    where: { id },
    data: { active },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: undefined }
}

// ==================== LOCATION ACTIONS ====================

export async function getLocations(warehouseId?: string): Promise<LocationData[]> {
  const locations = await prisma.location.findMany({
    where: {
      deletedAt: null,
      ...(warehouseId && { warehouseId }),
    },
    include: {
      warehouse: {
        select: { id: true, name: true },
      },
      _count: {
        select: { stockBalances: true },
      },
    },
    orderBy: { code: 'asc' },
  })

  return locations as LocationData[]
}

export async function createLocation(data: z.infer<typeof locationSchema>): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  const validation = locationSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  // Check duplicate code in same warehouse
  const existing = await prisma.location.findFirst({
    where: {
      warehouseId: data.warehouseId,
      code: data.code,
      deletedAt: null,
    },
  })
  if (existing) {
    return { success: false, error: 'รหัสตำแหน่งนี้มีอยู่แล้วในคลังนี้' }
  }

  const location = await prisma.location.create({
    data: {
      warehouseId: data.warehouseId,
      code: data.code,
      name: data.name,
      zone: data.zone || null,
      rack: data.rack || null,
      shelf: data.shelf || null,
      bin: data.bin || null,
    },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: { id: location.id } }
}

export async function updateLocation(
  id: string,
  data: Omit<z.infer<typeof locationSchema>, 'warehouseId'>
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  const location = await prisma.location.findUnique({ where: { id } })
  if (!location) {
    return { success: false, error: 'ไม่พบตำแหน่ง' }
  }

  // Check duplicate code in same warehouse (exclude self)
  const existing = await prisma.location.findFirst({
    where: {
      warehouseId: location.warehouseId,
      code: data.code,
      id: { not: id },
      deletedAt: null,
    },
  })
  if (existing) {
    return { success: false, error: 'รหัสตำแหน่งนี้มีอยู่แล้วในคลังนี้' }
  }

  await prisma.location.update({
    where: { id },
    data: {
      code: data.code,
      name: data.name,
      zone: data.zone || null,
      rack: data.rack || null,
      shelf: data.shelf || null,
      bin: data.bin || null,
    },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: { id } }
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  // Check if has stock
  const stockCount = await prisma.stockBalance.count({
    where: {
      locationId: id,
      qtyOnHand: { gt: 0 },
    },
  })

  if (stockCount > 0) {
    return { success: false, error: 'ไม่สามารถลบได้ เพราะมีสต๊อคอยู่ในตำแหน่งนี้' }
  }

  await prisma.location.update({
    where: { id },
    data: { deletedAt: new Date(), active: false },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: undefined }
}

export async function toggleLocationActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  await prisma.location.update({
    where: { id },
    data: { active },
  })

  revalidatePath('/settings/warehouses')
  return { success: true, data: undefined }
}
