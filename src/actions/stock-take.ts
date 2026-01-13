'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

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
            variant: true,
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

    return { success: true as const, data: stockTake }
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

    // Update each line
    for (const line of lines) {
      const validated = UpdateLineSchema.parse(line)
      
      await prisma.stockTakeLine.update({
        where: { id: validated.lineId },
        data: {
          countedQty: validated.countedQty,
          note: validated.note,
        },
      })
    }

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

    // Calculate variance for each line
    await prisma.$transaction(async (tx) => {
      for (const line of stockTake.lines) {
        const variance = Number(line.countedQty) - Number(line.systemQty)
        await tx.stockTakeLine.update({
          where: { id: line.id },
          data: { variance },
        })
      }

      await tx.stockTake.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    })

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

        // Update stock balances
        for (const line of linesWithVariance) {
          await tx.stockBalance.update({
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
        }

        // Update stock take status
        await tx.stockTake.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: session.id,
            approvedAt: new Date(),
          },
        })
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
