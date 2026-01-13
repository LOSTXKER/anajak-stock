'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import { revalidatePath } from 'next/cache'
import { POStatus, MovementType, DocStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import type { CreateGRNInput } from './schemas'
import { generateGRNNumber } from './helpers'

/**
 * Create GRN (Goods Received Note) from PO
 */
export async function createGRN(data: CreateGRNInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!data.lines || data.lines.length === 0) {
    return { success: false, error: 'กรุณาเพิ่มรายการรับสินค้า' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.pO.findUnique({
        where: { id: data.poId },
        include: { lines: true },
      })

      if (!po) {
        throw new Error('ไม่พบ PO')
      }

      if (!['SENT', 'IN_PROGRESS', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw new Error('ไม่สามารถรับสินค้าจาก PO นี้ได้')
      }

      const grnNumber = await generateGRNNumber()

      // Create GRN
      const grn = await tx.gRN.create({
        data: {
          grnNumber,
          poId: data.poId,
          receivedById: session.id,
          note: data.note,
          lines: {
            create: data.lines.map((line) => ({
              poLineId: line.poLineId,
              productId: line.productId,
              locationId: line.locationId,
              qtyReceived: line.qtyReceived,
              unitCost: line.unitCost,
              note: line.note,
            })),
          },
        },
      })

      // Update PO line quantities
      for (const line of data.lines) {
        await tx.pOLine.update({
          where: { id: line.poLineId },
          data: {
            qtyReceived: { increment: line.qtyReceived },
          },
        })
      }

      // Generate doc number for movement
      const movementSeq = await tx.docSequence.update({
        where: { docType: 'MOVEMENT' },
        data: { currentNo: { increment: 1 } },
      })
      const date = new Date()
      const year = date.getFullYear().toString().slice(-2)
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const movementNum = movementSeq.currentNo.toString().padStart(movementSeq.padLength, '0')
      const movementDocNumber = `${movementSeq.prefix}${year}${month}-${movementNum}`

      // Create stock movement for receive
      const movement = await tx.stockMovement.create({
        data: {
          docNumber: movementDocNumber,
          type: MovementType.RECEIVE,
          refType: 'GRN',
          refId: grn.id,
          status: DocStatus.POSTED,
          createdById: session.id,
          approvedById: session.id,
          postedAt: new Date(),
          lines: {
            create: data.lines
              .filter((line) => line.locationId)
              .map((line) => ({
                productId: line.productId,
                toLocationId: line.locationId,
                qty: line.qtyReceived,
                unitCost: line.unitCost,
              })),
          },
        },
      })

      // Update stock balances
      for (const line of data.lines) {
        if (line.locationId) {
          const variantId = line.variantId || null
          const existing = await tx.stockBalance.findFirst({
            where: {
              productId: line.productId,
              variantId,
              locationId: line.locationId,
            },
          })

          if (existing) {
            await tx.stockBalance.update({
              where: { id: existing.id },
              data: { qtyOnHand: { increment: line.qtyReceived } },
            })
          } else {
            await tx.stockBalance.create({
              data: {
                productId: line.productId,
                variantId,
                locationId: line.locationId,
                qtyOnHand: line.qtyReceived,
              },
            })
          }

          // Update product/variant last cost
          if (variantId) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: { lastCost: line.unitCost },
            })
          } else {
            await tx.product.update({
              where: { id: line.productId },
              data: { lastCost: line.unitCost },
            })
          }
        }
      }

      // Check if PO is fully received
      const updatedPO = await tx.pO.findUnique({
        where: { id: data.poId },
        include: { lines: true },
      })

      const isFullyReceived = updatedPO?.lines.every(
        (line) => Number(line.qtyReceived) >= Number(line.qty)
      )

      const newStatus = isFullyReceived
        ? POStatus.FULLY_RECEIVED
        : POStatus.PARTIALLY_RECEIVED

      await tx.pO.update({
        where: { id: data.poId },
        data: { status: newStatus },
      })

      await tx.pOTimeline.create({
        data: {
          poId: data.poId,
          action: isFullyReceived ? 'รับสินค้าครบ' : 'รับสินค้าบางส่วน',
          note: `GRN: ${grnNumber}`,
        },
      })

      return { grn, movement }
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'GRN',
        refId: result.grn.id,
        newData: { grnNumber: result.grn.grnNumber },
      },
    })

    revalidatePath('/po')
    revalidatePath(`/po/${data.poId}`)
    revalidatePath('/grn')
    revalidatePath('/stock')
    revalidatePath('/movements')
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return handleActionError(error, 'createGRN')
  }
}
