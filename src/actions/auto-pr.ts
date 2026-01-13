'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { PRStatus } from '@/generated/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

interface LowStockItem {
  productId: string
  productSku: string
  productName: string
  currentQty: number
  reorderPoint: number
  suggestedQty: number
}

export async function getLowStockForAutoPR(): Promise<LowStockItem[]> {
  const stockData = await prisma.stockBalance.findMany({
    where: {
      product: {
        reorderPoint: { gt: 0 },
        active: true,
        deletedAt: null,
      },
    },
    include: {
      product: true,
    },
  })

  // Group by product and sum quantities
  const productStocks = stockData.reduce((acc, item) => {
    const pid = item.productId
    if (!acc[pid]) {
      acc[pid] = {
        product: item.product,
        totalQty: 0,
      }
    }
    acc[pid].totalQty += Number(item.qtyOnHand)
    return acc
  }, {} as Record<string, { product: typeof stockData[0]['product']; totalQty: number }>)

  const lowStockItems: LowStockItem[] = []

  for (const [productId, data] of Object.entries(productStocks)) {
    const rop = Number(data.product.reorderPoint)
    const maxQty = Number(data.product.maxQty) || rop * 3
    const minQty = Number(data.product.minQty) || rop

    if (data.totalQty <= rop) {
      // Suggested quantity to bring stock to max or reasonable level
      const suggestedQty = Math.max(maxQty - data.totalQty, minQty)

      lowStockItems.push({
        productId,
        productSku: data.product.sku,
        productName: data.product.name,
        currentQty: data.totalQty,
        reorderPoint: rop,
        suggestedQty: Math.ceil(suggestedQty),
      })
    }
  }

  return lowStockItems.sort((a, b) => a.currentQty - b.currentQty)
}

export async function createAutoPR(productIds: string[]): Promise<ActionResult<{ prId: string; prNumber: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (productIds.length === 0) {
    return { success: false, error: 'กรุณาเลือกสินค้า' }
  }

  try {
    // Get low stock items for selected products
    const allLowStock = await getLowStockForAutoPR()
    const selectedItems = allLowStock.filter((item) => productIds.includes(item.productId))

    if (selectedItems.length === 0) {
      return { success: false, error: 'ไม่พบสินค้าที่ต้องสั่งซื้อ' }
    }

    // Generate PR number
    const sequence = await prisma.docSequence.update({
      where: { docType: 'PR' },
      data: { currentNo: { increment: 1 } },
    })

    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const num = sequence.currentNo.toString().padStart(sequence.padLength, '0')
    const prNumber = `${sequence.prefix}${year}${month}-${num}`

    // Create PR
    const pr = await prisma.pR.create({
      data: {
        prNumber,
        requesterId: session.id,
        status: PRStatus.DRAFT,
        priority: 'HIGH',
        note: 'Auto-generated PR จากระบบแจ้งเตือนสินค้าใกล้หมด',
        lines: {
          create: selectedItems.map((item) => ({
            productId: item.productId,
            qty: item.suggestedQty,
            note: `คงเหลือ: ${item.currentQty}, ROP: ${item.reorderPoint}`,
          })),
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'AUTO_CREATE',
        refType: 'PR',
        refId: pr.id,
        newData: { prNumber, itemCount: selectedItems.length },
      },
    })

    revalidatePath('/pr')
    revalidatePath('/reports/low-stock')

    return {
      success: true,
      data: { prId: pr.id, prNumber },
    }
  } catch (error) {
    console.error('Create Auto-PR error:', error)
    return { success: false, error: 'ไม่สามารถสร้าง PR อัตโนมัติได้' }
  }
}

export async function checkAndNotifyLowStock() {
  const lowStockItems = await getLowStockForAutoPR()

  // This could be extended to send email/notifications
  // For now, just return the count for dashboard

  return {
    count: lowStockItems.length,
    items: lowStockItems.slice(0, 10), // Top 10 most critical
  }
}
