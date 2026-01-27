'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/actions/notifications'

// ==================== SCHEMAS ====================

const CreateStockTakeSchema = z.object({
  warehouseId: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  note: z.string().optional(),
})

const UpdateLineSchema = z.object({
  lineId: z.string(),
  countedQty: z.number().min(0),
  note: z.string().optional(),
})

// ==================== HELPERS ====================

async function getNextStockTakeCode() {
  const sequence = await prisma.docSequence.upsert({
    where: { docType: 'STOCK_TAKE' },
    update: { currentNo: { increment: 1 } },
    create: {
      docType: 'STOCK_TAKE',
      prefix: 'ST',
      currentNo: 1,
      padLength: 6,
    },
  })

  const paddedNo = String(sequence.currentNo).padStart(sequence.padLength, '0')
  const yearMonth = new Date().toISOString().slice(2, 7).replace('-', '')
  return `${sequence.prefix}${yearMonth}${paddedNo}`
}

// ==================== ACTIONS ====================

export async function getStockTakes() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTakes = await prisma.stockTake.findMany({
      include: {
        warehouse: true,
        countedBy: true,
        approvedBy: true,
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { success: true as const, data: stockTakes }
  } catch (error) {
    console.error('Error getting stock takes:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function getStockTake(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTake = await prisma.stockTake.findUnique({
      where: { id },
      include: {
        warehouse: true,
        countedBy: true,
        approvedBy: true,
        lines: {
          include: {
            product: {
              include: { category: true },
            },
            variant: {
              include: {
                optionValues: {
                  include: {
                    optionValue: {
                      include: {
                        optionType: true,
                      },
                    },
                  },
                  orderBy: {
                    optionValue: {
                      optionType: { displayOrder: 'asc' },
                    },
                  },
                },
              },
            },
            location: true,
          },
          orderBy: [
            { product: { sku: 'asc' } },
            { location: { code: 'asc' } },
          ],
        },
      },
    })

    if (!stockTake) {
      return { success: false as const, error: 'ไม่พบใบตรวจนับ' }
    }

    // Convert Decimal to Number for Client Component compatibility
    const serializedStockTake = {
      ...stockTake,
      lines: stockTake.lines.map(line => ({
        ...line,
        systemQty: Number(line.systemQty),
        countedQty: line.countedQty !== null ? Number(line.countedQty) : null,
        variance: line.variance !== null ? Number(line.variance) : null,
        product: {
          ...line.product,
          reorderPoint: Number(line.product.reorderPoint),
          minQty: line.product.minQty !== null ? Number(line.product.minQty) : null,
          maxQty: line.product.maxQty !== null ? Number(line.product.maxQty) : null,
          standardCost: line.product.standardCost !== null ? Number(line.product.standardCost) : null,
          lastCost: line.product.lastCost !== null ? Number(line.product.lastCost) : null,
        },
        variant: line.variant ? {
          ...line.variant,
          costPrice: Number(line.variant.costPrice),
          sellingPrice: line.variant.sellingPrice !== null ? Number(line.variant.sellingPrice) : null,
          lastCost: line.variant.lastCost !== null ? Number(line.variant.lastCost) : null,
          reorderPoint: line.variant.reorderPoint !== null ? Number(line.variant.reorderPoint) : null,
          minQty: line.variant.minQty !== null ? Number(line.variant.minQty) : null,
          maxQty: line.variant.maxQty !== null ? Number(line.variant.maxQty) : null,
        } : null,
      })),
    }

    return { success: true as const, data: serializedStockTake }
  } catch (error) {
    console.error('Error getting stock take:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function createStockTake(input: { warehouseId: string; note?: string }) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const validated = CreateStockTakeSchema.parse(input)
    const code = await getNextStockTakeCode()

    // Get all stock balances for this warehouse
    const stockBalances = await prisma.stockBalance.findMany({
      where: {
        location: {
          warehouseId: validated.warehouseId,
        },
        qtyOnHand: { gt: 0 },
      },
      include: {
        product: true,
        variant: true,
        location: true,
      },
    })

    // Create stock take with lines
    const stockTake = await prisma.stockTake.create({
      data: {
        code,
        warehouseId: validated.warehouseId,
        note: validated.note,
        status: 'DRAFT',
        lines: {
          create: stockBalances.map((sb) => ({
            productId: sb.productId,
            variantId: sb.variantId,
            locationId: sb.locationId,
            systemQty: sb.qtyOnHand,
          })),
        },
      },
      include: {
        warehouse: true,
        lines: true,
      },
    })

    revalidatePath('/stock-take')
    return { success: true as const, data: stockTake }
  } catch (error) {
    console.error('Error creating stock take:', error)
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0].message }
    }
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการสร้างใบตรวจนับ' }
  }
}

export async function startStockTake(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTake = await prisma.stockTake.findUnique({
      where: { id },
    })

    if (!stockTake) {
      return { success: false as const, error: 'ไม่พบใบตรวจนับ' }
    }

    if (stockTake.status !== 'DRAFT') {
      return { success: false as const, error: 'ใบตรวจนับไม่ได้อยู่ในสถานะแบบร่าง' }
    }

    await prisma.stockTake.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        countedById: session.id,
      },
    })

    revalidatePath('/stock-take')
    revalidatePath(`/stock-take/${id}`)
    return { success: true as const, data: undefined }
  } catch (error) {
    console.error('Error starting stock take:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}

export async function updateStockTakeLines(stockTakeId: string, lines: Array<{ lineId: string; countedQty: number; note?: string }>) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTake = await prisma.stockTake.findUnique({
      where: { id: stockTakeId },
    })

    if (!stockTake) {
      return { success: false as const, error: 'ไม่พบใบตรวจนับ' }
    }

    if (stockTake.status !== 'IN_PROGRESS') {
      return { success: false as const, error: 'ใบตรวจนับไม่ได้อยู่ในสถานะกำลังนับ' }
    }

    // Validate all lines first
    const validatedLines = lines.map(line => UpdateLineSchema.parse(line))

    // Update all lines in parallel
    await Promise.all(
      validatedLines.map(line =>
        prisma.stockTakeLine.update({
          where: { id: line.lineId },
          data: {
            countedQty: line.countedQty,
            note: line.note,
          },
        })
      )
    )

    revalidatePath(`/stock-take/${stockTakeId}`)
    return { success: true as const, data: undefined }
  } catch (error) {
    console.error('Error updating stock take lines:', error)
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0].message }
    }
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการบันทึก' }
  }
}

export async function completeStockTake(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTake = await prisma.stockTake.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!stockTake) {
      return { success: false as const, error: 'ไม่พบใบตรวจนับ' }
    }

    if (stockTake.status !== 'IN_PROGRESS') {
      return { success: false as const, error: 'ใบตรวจนับไม่ได้อยู่ในสถานะกำลังนับ' }
    }

    // Check if all lines have been counted
    const uncountedLines = stockTake.lines.filter((l) => l.countedQty === null)
    if (uncountedLines.length > 0) {
      return { success: false as const, error: `ยังมีรายการที่ยังไม่ได้นับ ${uncountedLines.length} รายการ` }
    }

    // Calculate variance for each line in parallel
    await prisma.$transaction(async (tx) => {
      // Update all variances in parallel
      await Promise.all(
        stockTake.lines.map(line => {
          const variance = Number(line.countedQty) - Number(line.systemQty)
          return tx.stockTakeLine.update({
            where: { id: line.id },
            data: { variance },
          })
        })
      )

      await tx.stockTake.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    }, {
      timeout: 30000, // 30 seconds - คำนวณ variance หลายรายการอาจใช้เวลานาน
      maxWait: 10000,
    })

    // Send notifications to approvers
    notifyStockTakeCompleted(id, stockTake.code, session.name).catch((err) =>
      console.error('Failed to send stock take completion notifications:', err)
    )

    revalidatePath('/stock-take')
    revalidatePath(`/stock-take/${id}`)
    return { success: true as const, data: undefined }
  } catch (error) {
    console.error('Error completing stock take:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}

export async function approveStockTake(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTake = await prisma.stockTake.findUnique({
      where: { id },
      include: { 
        lines: true,
        warehouse: true,
      },
    })

    if (!stockTake) {
      return { success: false as const, error: 'ไม่พบใบตรวจนับ' }
    }

    if (stockTake.status !== 'COMPLETED') {
      return { success: false as const, error: 'ใบตรวจนับยังไม่เสร็จสมบูรณ์' }
    }

    // Create adjustment movement for items with variance
    const linesWithVariance = stockTake.lines.filter((l) => l.variance && Number(l.variance) !== 0)

    if (linesWithVariance.length > 0) {
      // Get next doc number for movement
      const sequence = await prisma.docSequence.upsert({
        where: { docType: 'MOVEMENT' },
        update: { currentNo: { increment: 1 } },
        create: {
          docType: 'MOVEMENT',
          prefix: 'MV',
          currentNo: 1,
          padLength: 6,
        },
      })

      const paddedNo = String(sequence.currentNo).padStart(sequence.padLength, '0')
      const yearMonth = new Date().toISOString().slice(2, 7).replace('-', '')
      const docNumber = `ADJ${yearMonth}${paddedNo}`

      await prisma.$transaction(async (tx) => {
        // Create adjustment movement
        const movement = await tx.stockMovement.create({
          data: {
            docNumber,
            type: 'ADJUST',
            refType: 'STOCK_TAKE',
            refId: stockTake.id,
            status: 'POSTED',
            note: `ปรับยอดจากการตรวจนับ ${stockTake.code}`,
            createdById: session.id,
            approvedById: session.id,
            postedAt: new Date(),
            lines: {
              create: linesWithVariance.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                toLocationId: line.locationId,
                qty: line.variance!,
                unitCost: 0,
                note: `ปรับจากตรวจนับ: ระบบ ${line.systemQty} นับได้ ${line.countedQty}`,
              })),
            },
          },
        })

        // Update stock balances in parallel
        await Promise.all(
          linesWithVariance.map(line =>
            tx.stockBalance.update({
              where: {
                productId_variantId_locationId: {
                  productId: line.productId,
                  variantId: line.variantId ?? '',
                  locationId: line.locationId,
                },
              },
              data: {
                qtyOnHand: line.countedQty!,
              },
            })
          )
        )

        // Update stock take status
        await tx.stockTake.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: session.id,
            approvedAt: new Date(),
          },
        })
      }, {
        timeout: 30000, // 30 seconds - การอนุมัติตรวจนับหลายรายการอาจใช้เวลานาน
        maxWait: 10000,
      })
    } else {
      // No variance, just approve
      await prisma.stockTake.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: session.id,
          approvedAt: new Date(),
        },
      })
    }

    revalidatePath('/stock-take')
    revalidatePath(`/stock-take/${id}`)
    revalidatePath('/movements')
    return { success: true as const, data: undefined }
  } catch (error) {
    console.error('Error approving stock take:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการอนุมัติ' }
  }
}

export async function cancelStockTake(id: string) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const stockTake = await prisma.stockTake.findUnique({
      where: { id },
    })

    if (!stockTake) {
      return { success: false as const, error: 'ไม่พบใบตรวจนับ' }
    }

    if (stockTake.status === 'APPROVED') {
      return { success: false as const, error: 'ไม่สามารถยกเลิกใบตรวจนับที่อนุมัติแล้ว' }
    }

    await prisma.stockTake.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    revalidatePath('/stock-take')
    revalidatePath(`/stock-take/${id}`)
    return { success: true as const, data: undefined }
  } catch (error) {
    console.error('Error cancelling stock take:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}

export async function getWarehouses() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: 'asc' },
    })
    return { success: true as const, data: warehouses }
  } catch (error) {
    console.error('Error getting warehouses:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาด' }
  }
}

// ============================================
// Notification Helpers
// ============================================

/**
 * Send notifications to all approvers when a stock take is completed
 */
async function notifyStockTakeCompleted(
  stockTakeId: string,
  code: string,
  counterName: string
) {
  // Get all approvers (ADMIN and APPROVER roles)
  const approvers = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'APPROVER'] },
    },
    select: { id: true },
  })

  // Create in-app notifications for all approvers
  const notificationPromises = approvers.map((approver) =>
    createNotification({
      userId: approver.id,
      type: 'system',
      title: `ตรวจนับรออนุมัติ: ${code}`,
      message: `${counterName} นับสต๊อกเสร็จแล้ว รอการอนุมัติ`,
      url: `/stock-take/${stockTakeId}`,
    })
  )

  // Execute all in parallel
  await Promise.allSettled(notificationPromises)
}
