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
              variantId: line.variantId || null,
              locationId: line.locationId,
              qtyReceived: line.qtyReceived,
              unitCost: line.unitCost,
              note: line.note,
            })),
          },
        },
      })

      // Update PO line quantities - batch by using Promise.all
      await Promise.all(
        data.lines.map(line =>
          tx.pOLine.update({
            where: { id: line.poLineId },
            data: { qtyReceived: { increment: line.qtyReceived } },
          })
        )
      )

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
                variantId: line.variantId || null,
                toLocationId: line.locationId,
                qty: line.qtyReceived,
                unitCost: line.unitCost,
              })),
          },
        },
      })

      // Update stock balances using upsert (more efficient than findFirst + update/create)
      const linesWithLocation = data.lines.filter((line): line is typeof line & { locationId: string } => !!line.locationId)
      await Promise.all(
        linesWithLocation.map(line => {
          const variantId = line.variantId || null
          return tx.stockBalance.upsert({
            where: {
              productId_variantId_locationId: {
                productId: line.productId,
                variantId: variantId || '',
                locationId: line.locationId,
              },
            },
            create: {
              productId: line.productId,
              variantId,
              locationId: line.locationId,
              qtyOnHand: line.qtyReceived,
            },
            update: {
              qtyOnHand: { increment: line.qtyReceived },
            },
          })
        })
      )

      // Update product/variant last cost in parallel
      const variantUpdates = linesWithLocation.filter(l => l.variantId)
      const productUpdates = linesWithLocation.filter(l => !l.variantId)

      await Promise.all([
        ...variantUpdates.map(line =>
          tx.productVariant.update({
            where: { id: line.variantId! },
            data: { lastCost: line.unitCost },
          })
        ),
        ...productUpdates.map(line =>
          tx.product.update({
            where: { id: line.productId },
            data: { lastCost: line.unitCost },
          })
        ),
      ])

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
    }, {
      timeout: 30000, // 30 seconds - รับสินค้าหลายรายการอาจใช้เวลานาน
      maxWait: 10000, // max wait for connection
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

/**
 * Post GRN to stock (mark as posted) - For GRNs created as DRAFT
 */
export async function postGRN(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const grn = await prisma.gRN.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!grn) {
      return { success: false, error: 'ไม่พบ GRN' }
    }

    if (grn.status === 'POSTED') {
      return { success: false, error: 'GRN นี้ถูก Post แล้ว' }
    }

    if (grn.status === 'CANCELLED') {
      return { success: false, error: 'GRN นี้ถูกยกเลิกแล้ว' }
    }

    await prisma.gRN.update({
      where: { id },
      data: {
        status: 'POSTED',
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'POST',
        refType: 'GRN',
        refId: id,
      },
    })

    revalidatePath('/grn')
    revalidatePath(`/grn/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'postGRN')
  }
}

/**
 * Cancel GRN
 */
export async function cancelGRN(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const grn = await prisma.gRN.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!grn) {
      return { success: false, error: 'ไม่พบ GRN' }
    }

    if (grn.status === 'POSTED') {
      return { success: false, error: 'ไม่สามารถยกเลิก GRN ที่ Post แล้วได้' }
    }

    if (grn.status === 'CANCELLED') {
      return { success: false, error: 'GRN นี้ถูกยกเลิกแล้ว' }
    }

    await prisma.gRN.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        note: reason ? `${grn.note || ''}\n[ยกเลิก] ${reason}` : grn.note,
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CANCEL',
        refType: 'GRN',
        refId: id,
        newData: { reason },
      },
    })

    revalidatePath('/grn')
    revalidatePath(`/grn/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return handleActionError(error, 'cancelGRN')
  }
}
