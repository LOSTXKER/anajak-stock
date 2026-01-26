'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { serialize } from '@/lib/serialize'
import type { ActionResult, PaginatedResult, ProductWithRelations } from '@/types'
import { StockType } from '@/generated/prisma'

const productSchema = z.object({
  sku: z.string().min(1, 'กรุณากรอก SKU'),
  name: z.string().min(1, 'กรุณากรอกชื่อสินค้า'),
  description: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  stockType: z.nativeEnum(StockType).default(StockType.STOCKED),
  reorderPoint: z.number().min(0).default(0),
  minQty: z.number().min(0).default(0),
  maxQty: z.number().min(0).default(0),
  standardCost: z.number().min(0).default(0),
  initialStock: z.object({
    locationId: z.string(),
    qty: z.number().min(1),
    note: z.string().optional(),
  }).optional(),
})

type ProductInput = z.infer<typeof productSchema>

export async function getProducts(params: {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  active?: boolean
}): Promise<PaginatedResult<ProductWithRelations>> {
  const { page = 1, limit = 20, search, categoryId, active = true } = params

  const where = {
    active,
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
        { barcode: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(categoryId && { categoryId }),
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ])

  return {
    items: items.map(item => serialize(item)) as ProductWithRelations[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getProduct(id: string): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      unit: true,
      stockBalances: {
        include: {
          location: {
            include: {
              warehouse: true,
            },
          },
        },
      },
    },
  })

  if (!product) return null
  return serialize(product) as ProductWithRelations
}

export async function getProductByBarcode(barcode: string): Promise<{
  product: ProductWithRelations
  variant?: { id: string; sku: string; name: string | null; barcode: string | null }
  stock: { locationId: string; locationName: string; warehouseName: string; qty: number }[]
} | null> {
  if (!barcode.trim()) return null

  let foundVariant: { id: string; sku: string; name: string | null; barcode: string | null } | undefined

  // First try exact barcode match on product
  let product = await prisma.product.findUnique({
    where: { barcode: barcode.trim() },
    include: {
      category: true,
      unit: true,
      stockBalances: {
        include: {
          location: {
            include: {
              warehouse: true,
            },
          },
        },
      },
    },
  })

  // If not found, try product SKU match
  if (!product) {
    product = await prisma.product.findUnique({
      where: { sku: barcode.trim() },
      include: {
        category: true,
        unit: true,
        stockBalances: {
          include: {
            location: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    })
  }

  // If not found, try variant barcode match
  if (!product) {
    const variant = await prisma.productVariant.findFirst({
      where: { barcode: barcode.trim() },
      include: {
        product: {
          include: {
            category: true,
            unit: true,
            stockBalances: {
              include: {
                location: {
                  include: {
                    warehouse: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (variant) {
      product = variant.product
      foundVariant = {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        barcode: variant.barcode,
      }
    }
  }

  // If still not found, try variant SKU match
  if (!product) {
    const variant = await prisma.productVariant.findUnique({
      where: { sku: barcode.trim() },
      include: {
        product: {
          include: {
            category: true,
            unit: true,
            stockBalances: {
              include: {
                location: {
                  include: {
                    warehouse: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (variant) {
      product = variant.product
      foundVariant = {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        barcode: variant.barcode,
      }
    }
  }

  if (!product) return null

  // Filter stock by variant if we found a specific variant
  const relevantBalances = foundVariant
    ? product.stockBalances.filter(sb => sb.variantId === foundVariant!.id)
    : product.stockBalances.filter(sb => sb.variantId === null)

  const stock = relevantBalances.map(sb => ({
    locationId: sb.locationId,
    locationName: sb.location.name,
    warehouseName: sb.location.warehouse.name,
    qty: Number(sb.qtyOnHand),
  }))

  return {
    product: serialize(product) as ProductWithRelations,
    variant: foundVariant,
    stock,
  }
}

export async function createProduct(data: ProductInput): Promise<ActionResult<ProductWithRelations>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const validated = productSchema.parse(data)

    // Check duplicate SKU
    const existing = await prisma.product.findUnique({
      where: { sku: validated.sku },
    })

    if (existing) {
      return { success: false, error: 'SKU นี้มีอยู่ในระบบแล้ว' }
    }

    // Check duplicate barcode
    if (validated.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: validated.barcode },
      })
      if (existingBarcode) {
        return { success: false, error: 'Barcode นี้มีอยู่ในระบบแล้ว' }
      }
    }

    // Use transaction for product + initial stock
    const product = await prisma.$transaction(async (tx) => {
      // Create product
      const newProduct = await tx.product.create({
        data: {
          sku: validated.sku,
          name: validated.name,
          description: validated.description,
          barcode: validated.barcode || null,
          categoryId: validated.categoryId || null,
          unitId: validated.unitId || null,
          reorderPoint: validated.reorderPoint,
          minQty: validated.minQty,
          maxQty: validated.maxQty,
          standardCost: validated.standardCost,
          lastCost: validated.standardCost,
        },
        include: {
          category: true,
          unit: true,
        },
      })

      // Create initial stock if provided
      if (validated.initialStock) {
        const { locationId, qty, note } = validated.initialStock

        // Generate movement number
        const today = new Date()
        const prefix = `RCV${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
        const lastMovement = await tx.stockMovement.findFirst({
          where: { docNumber: { startsWith: prefix } },
          orderBy: { docNumber: 'desc' },
        })
        const seq = lastMovement
          ? parseInt(lastMovement.docNumber.slice(-4)) + 1
          : 1
        const docNumber = `${prefix}${String(seq).padStart(4, '0')}`

        // Create RECEIVE movement
        const movement = await tx.stockMovement.create({
          data: {
            docNumber,
            type: 'RECEIVE',
            status: 'POSTED',
            createdById: session.id,
            approvedById: session.id,
            postedAt: new Date(),
            note: note || 'สต๊อคเริ่มต้นจากการสร้างสินค้า',
            lines: {
              create: {
                productId: newProduct.id,
                toLocationId: locationId,
                qty,
                unitCost: validated.standardCost,
              },
            },
          },
        })

        // Update stock balance
        await tx.stockBalance.upsert({
          where: {
            productId_variantId_locationId: {
              productId: newProduct.id,
              variantId: '',
              locationId,
            },
          },
          create: {
            productId: newProduct.id,
            locationId,
            qtyOnHand: qty,
          },
          update: {
            qtyOnHand: { increment: qty },
          },
        })

        // Audit log for movement
        await tx.auditLog.create({
          data: {
            actorId: session.id,
            action: 'CREATE',
            refType: 'MOVEMENT',
            refId: movement.id,
            newData: { docNumber, type: 'RECEIVE', qty, note: 'สต๊อคเริ่มต้น' },
          },
        })
      }

      return newProduct
    })

    // Audit log for product (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'PRODUCT',
        refId: product.id,
        newData: product,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/products')
    revalidatePath('/movements')
    revalidatePath('/stock')
    return { success: true, data: product as ProductWithRelations }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Create product error:', error)
    return { success: false, error: 'ไม่สามารถสร้างสินค้าได้' }
  }
}

export async function updateProduct(
  id: string,
  data: Partial<ProductInput>
): Promise<ActionResult<ProductWithRelations>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) {
      return { success: false, error: 'ไม่พบสินค้า' }
    }

    // Check duplicate SKU if changed
    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku: data.sku },
      })
      if (duplicateSku) {
        return { success: false, error: 'SKU นี้มีอยู่ในระบบแล้ว' }
      }
    }

    // Check duplicate barcode if changed
    if (data.barcode && data.barcode !== existing.barcode) {
      const duplicateBarcode = await prisma.product.findUnique({
        where: { barcode: data.barcode },
      })
      if (duplicateBarcode) {
        return { success: false, error: 'Barcode นี้มีอยู่ในระบบแล้ว' }
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.sku && { sku: data.sku }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.barcode !== undefined && { barcode: data.barcode || null }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId || null }),
        ...(data.unitId !== undefined && { unitId: data.unitId || null }),
        ...(data.stockType !== undefined && { stockType: data.stockType }),
        ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
        ...(data.minQty !== undefined && { minQty: data.minQty }),
        ...(data.maxQty !== undefined && { maxQty: data.maxQty }),
        ...(data.standardCost !== undefined && { standardCost: data.standardCost }),
      },
      include: {
        category: true,
        unit: true,
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'PRODUCT',
        refId: product.id,
        oldData: existing,
        newData: product,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    return { success: true, data: product as ProductWithRelations }
  } catch (error) {
    console.error('Update product error:', error)
    return { success: false, error: 'ไม่สามารถอัปเดตสินค้าได้' }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) {
      return { success: false, error: 'ไม่พบสินค้า' }
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'PRODUCT',
        refId: id,
        oldData: existing,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/products')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Delete product error:', error)
    return { success: false, error: 'ไม่สามารถลบสินค้าได้' }
  }
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { name: 'asc' },
  })
}

export async function getUnits() {
  return prisma.unitOfMeasure.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { name: 'asc' },
  })
}

export async function getProductById(id: string): Promise<ActionResult<ProductWithRelations>> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        unit: true,
      },
    })

    if (!product) {
      return { success: false, error: 'ไม่พบสินค้า' }
    }

    // Serialize to convert Decimal to number for client components
    return { success: true, data: serialize(product) as ProductWithRelations }
  } catch (error) {
    console.error('Get product by ID error:', error)
    return { success: false, error: 'ไม่สามารถดึงข้อมูลสินค้าได้' }
  }
}

/**
 * Update product option groups
 */
export async function updateProductOptionGroups(
  productId: string,
  optionGroups: { name: string; values: string[] }[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const existing = await prisma.product.findUnique({ where: { id: productId } })
    if (!existing) {
      return { success: false, error: 'ไม่พบสินค้า' }
    }

    // Validate option groups
    for (const group of optionGroups) {
      if (!group.name.trim()) {
        return { success: false, error: 'ชื่อกลุ่มตัวเลือกต้องไม่ว่าง' }
      }
      if (group.values.length === 0) {
        return { success: false, error: `กลุ่ม "${group.name}" ต้องมีค่าอย่างน้อย 1 ค่า` }
      }
      // Remove empty values and duplicates
      group.values = [...new Set(group.values.filter(v => v.trim()))]
    }

    // Check for duplicate group names
    const groupNames = optionGroups.map(g => g.name.toLowerCase().trim())
    if (new Set(groupNames).size !== groupNames.length) {
      return { success: false, error: 'ชื่อกลุ่มตัวเลือกต้องไม่ซ้ำกัน' }
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        optionGroups: optionGroups,
        hasVariants: optionGroups.length > 0,
      },
    })

    // Audit log (run in background - non-blocking)
    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE',
        refType: 'PRODUCT',
        refId: productId,
        oldData: { optionGroups: existing.optionGroups },
        newData: { optionGroups },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath(`/products/${productId}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Update option groups error:', error)
    return { success: false, error: 'ไม่สามารถอัปเดตตัวเลือกได้' }
  }
}
