'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { MovementType, DocStatus } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { NOTIFICATION_TEMPLATES } from '@/lib/notification-templates'
import type { NotificationTypeKey } from '@/actions/user-notification-preferences'
import {
  generateDocNumber,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_NOTIFICATION_PREFIX,
  type ReturnLineInput,
} from './shared'

export async function submitMovement(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.DRAFT && movement.status !== DocStatus.REJECTED) {
      return { success: false, error: 'ไม่สามารถส่งรายการที่ส่งอนุมัติหรือดำเนินการแล้วได้' }
    }

    if (movement.lines.length === 0) {
      return { success: false, error: 'กรุณาเพิ่มรายการสินค้าก่อนส่ง' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: { status: DocStatus.SUBMITTED },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'SUBMIT',
        refType: 'MOVEMENT',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    notifyMovementSubmitted(id, movement.docNumber, movement.type, session.name).catch((err) =>
      console.error('Failed to send movement submission notifications:', err)
    )

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Submit movement error:', error)
    return { success: false, error: 'ไม่สามารถส่งรายการได้' }
  }
}

export async function approveMovement(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถอนุมัติรายการที่ไม่ใช่ Submitted ได้' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: {
        status: DocStatus.APPROVED,
        approvedById: session.id,
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'APPROVE',
        refType: 'MOVEMENT',
        refId: id,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Approve movement error:', error)
    return { success: false, error: 'ไม่สามารถอนุมัติรายการได้' }
  }
}

export async function postMovement(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUnique({
        where: { id },
        include: {
          lines: {
            include: { 
              product: true,
              variant: true,
              lotMovementLines: {
                include: { lot: true },
              },
            },
          },
        },
      })

      if (!movement) {
        throw new Error('ไม่พบรายการ')
      }

      if (movement.status !== DocStatus.APPROVED) {
        throw new Error('ไม่สามารถ Post รายการที่ยังไม่อนุมัติได้')
      }

      async function getStockBalance(productId: string, variantId: string | null, locationId: string) {
        return tx.stockBalance.findFirst({
          where: {
            productId,
            variantId: variantId || null,
            locationId,
          },
        })
      }

      async function incrementStock(productId: string, variantId: string | null, locationId: string, qty: number) {
        const existing = await getStockBalance(productId, variantId, locationId)
        if (existing) {
          await tx.stockBalance.update({
            where: { id: existing.id },
            data: { qtyOnHand: { increment: qty } },
          })
        } else {
          await tx.stockBalance.create({
            data: {
              productId,
              variantId: variantId || null,
              locationId,
              qtyOnHand: qty,
            },
          })
        }
      }

      async function decrementStock(productId: string, variantId: string | null, locationId: string, qty: number, productName: string) {
        const existing = await getStockBalance(productId, variantId, locationId)
        const currentQty = Number(existing?.qtyOnHand ?? 0)
        if (currentQty < qty) {
          throw new Error(`สินค้า ${productName} มีไม่เพียงพอ (มี ${currentQty}, ต้องการ ${qty})`)
        }
        if (existing) {
          await tx.stockBalance.update({
            where: { id: existing.id },
            data: { qtyOnHand: { decrement: qty } },
          })
        }
      }

      async function incrementLotBalance(lotId: string, locationId: string, qty: number) {
        const existing = await tx.lotBalance.findFirst({
          where: { lotId, locationId },
        })
        if (existing) {
          await tx.lotBalance.update({
            where: { lotId_locationId: { lotId, locationId } },
            data: { qtyOnHand: { increment: qty } },
          })
        } else {
          await tx.lotBalance.create({
            data: { lotId, locationId, qtyOnHand: qty },
          })
        }
      }

      async function decrementLotBalance(lotId: string, locationId: string, qty: number, lotNumber: string) {
        const existing = await tx.lotBalance.findFirst({
          where: { lotId, locationId },
        })
        const currentQty = Number(existing?.qtyOnHand ?? 0)
        if (currentQty < qty) {
          throw new Error(`Lot ${lotNumber} มีไม่เพียงพอ (มี ${currentQty}, ต้องการ ${qty})`)
        }
        if (existing) {
          await tx.lotBalance.update({
            where: { lotId_locationId: { lotId, locationId } },
            data: { qtyOnHand: { decrement: qty } },
          })
        }
      }

      for (const line of movement.lines) {
        const qty = Number(line.qty)
        const variantId = line.variantId || null
        const productName = line.variant 
          ? `${line.product.name} (${line.variant.sku})`
          : line.product.name
        
        const lotMovement = line.lotMovementLines[0]
        const lotId = lotMovement?.lotId
        const lotNumber = lotMovement?.lot?.lotNumber

        switch (movement.type) {
          case MovementType.RECEIVE:
            if (line.toLocationId) {
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
              if (lotId) {
                await incrementLotBalance(lotId, line.toLocationId, qty)
              }
            }
            break

          case MovementType.ISSUE:
            if (line.fromLocationId) {
              await decrementStock(line.productId, variantId, line.fromLocationId, qty, productName)
              if (lotId && lotNumber) {
                await decrementLotBalance(lotId, line.fromLocationId, qty, lotNumber)
              }
            }
            break

          case MovementType.TRANSFER:
            if (line.fromLocationId && line.toLocationId) {
              await decrementStock(line.productId, variantId, line.fromLocationId, qty, productName)
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
              if (lotId && lotNumber) {
                await decrementLotBalance(lotId, line.fromLocationId, qty, lotNumber)
                await incrementLotBalance(lotId, line.toLocationId, qty)
              }
            }
            break

          case MovementType.ADJUST:
            if (line.toLocationId) {
              if (qty >= 0) {
                await incrementStock(line.productId, variantId, line.toLocationId, qty)
                if (lotId) {
                  await incrementLotBalance(lotId, line.toLocationId, qty)
                }
              } else {
                await decrementStock(line.productId, variantId, line.toLocationId, Math.abs(qty), productName)
                if (lotId && lotNumber) {
                  await decrementLotBalance(lotId, line.toLocationId, Math.abs(qty), lotNumber)
                }
              }
            }
            break

          case MovementType.RETURN:
            if (line.toLocationId) {
              await incrementStock(line.productId, variantId, line.toLocationId, qty)
              if (lotId) {
                await incrementLotBalance(lotId, line.toLocationId, qty)
              }
            }
            break
        }
      }

      await tx.stockMovement.update({
        where: { id },
        data: {
          status: DocStatus.POSTED,
          postedAt: new Date(),
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: session.id,
          action: 'POST',
          refType: 'MOVEMENT',
          refId: id,
        },
      })

      return movement
    }, {
      timeout: 30000,
      maxWait: 10000,
    })

    notifyMovementPosted(id, result.docNumber, result.type, result.createdById).catch((err) =>
      console.error('Failed to send movement posted notifications:', err)
    )

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    revalidatePath('/stock')
    revalidatePath('/dashboard')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Post movement error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'ไม่สามารถ Post รายการได้' }
  }
}

export async function rejectMovement(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.SUBMITTED) {
      return { success: false, error: 'ไม่สามารถปฏิเสธรายการที่ไม่ใช่ Submitted ได้' }
    }

    await prisma.stockMovement.update({
      where: { id },
      data: {
        status: DocStatus.REJECTED,
        note: reason ? `${movement.note || ''}\n[ปฏิเสธ] ${reason}` : movement.note,
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'REJECT',
        refType: 'MOVEMENT',
        refId: id,
        newData: { reason },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Reject movement error:', error)
    return { success: false, error: 'ไม่สามารถปฏิเสธรายการได้' }
  }
}

export async function reverseMovement(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            variant: true,
            lotMovementLines: true,
          },
        },
      },
    })

    if (!movement) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    if (movement.status !== DocStatus.POSTED) {
      return { success: false, error: 'สามารถกลับรายการได้เฉพาะเอกสารที่ Post แล้วเท่านั้น' }
    }

    const existingReversal = await prisma.stockMovement.findFirst({
      where: {
        refType: 'REVERSAL',
        refId: id,
        status: { notIn: [DocStatus.CANCELLED, DocStatus.REJECTED] },
      },
    })

    if (existingReversal) {
      return { success: false, error: 'รายการนี้ถูกกลับรายการแล้ว' }
    }

    let reverseType: MovementType
    switch (movement.type) {
      case MovementType.RECEIVE:
        reverseType = MovementType.ISSUE
        break
      case MovementType.ISSUE:
        reverseType = MovementType.RECEIVE
        break
      case MovementType.TRANSFER:
        reverseType = MovementType.TRANSFER
        break
      case MovementType.ADJUST:
        reverseType = MovementType.ADJUST
        break
      case MovementType.RETURN:
        reverseType = MovementType.ISSUE
        break
      default:
        reverseType = MovementType.ADJUST
    }

    const docNumber = await generateDocNumber('MOVEMENT')

    const reversedMovement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: reverseType,
        status: DocStatus.DRAFT,
        refType: 'REVERSAL',
        refId: id,
        note: `กลับรายการจาก ${movement.docNumber}`,
        reason: 'กลับรายการ (Reversal)',
        projectCode: movement.projectCode,
        createdById: session.id,
        lines: {
          create: movement.lines.map((line) => {
            const isTransfer = movement.type === MovementType.TRANSFER
            const fromLocationId = isTransfer ? line.toLocationId : line.fromLocationId
            const toLocationId = isTransfer ? line.fromLocationId : line.toLocationId

            const qty = movement.type === MovementType.ADJUST ? -Number(line.qty) : Number(line.qty)

            return {
              productId: line.productId,
              variantId: line.variantId || null,
              fromLocationId: reverseType === MovementType.ISSUE || reverseType === MovementType.TRANSFER 
                ? (fromLocationId || line.toLocationId) 
                : null,
              toLocationId: reverseType === MovementType.RECEIVE || reverseType === MovementType.TRANSFER 
                ? (toLocationId || line.fromLocationId) 
                : null,
              qty,
              unitCost: Number(line.unitCost),
              note: `กลับรายการจาก line: ${line.id}`,
              ...(line.lotMovementLines[0] && {
                lotMovementLines: {
                  create: {
                    lotId: line.lotMovementLines[0].lotId,
                    qty,
                  },
                },
              }),
            }
          }),
        },
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE_REVERSAL',
        refType: 'MOVEMENT',
        refId: reversedMovement.id,
        newData: { originalMovementId: id, originalDocNumber: movement.docNumber },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${id}`)

    return { success: true, data: { id: reversedMovement.id } }
  } catch (error) {
    console.error('Reverse movement error:', error)
    return { success: false, error: 'ไม่สามารถกลับรายการได้' }
  }
}

export async function createReturnFromIssue(
  issueId: string,
  returnLines: ReturnLineInput[]
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!returnLines || returnLines.length === 0) {
    return { success: false, error: 'กรุณาระบุรายการที่ต้องการคืน' }
  }

  try {
    const issueMovement = await prisma.stockMovement.findUnique({
      where: { id: issueId },
      include: {
        lines: {
          include: {
            product: true,
            variant: true,
            fromLocation: true,
            lotMovementLines: true,
          },
        },
      },
    })

    if (!issueMovement) {
      return { success: false, error: 'ไม่พบรายการเบิกออก' }
    }

    if (issueMovement.type !== MovementType.ISSUE) {
      return { success: false, error: 'สามารถสร้างรายการคืนได้จากรายการเบิกออกเท่านั้น' }
    }

    if (issueMovement.status !== DocStatus.POSTED) {
      return { success: false, error: 'สามารถสร้างรายการคืนได้จากรายการที่ Post แล้วเท่านั้น' }
    }

    for (const returnLine of returnLines) {
      const originalLine = issueMovement.lines.find(l => l.id === returnLine.lineId)
      if (!originalLine) {
        return { success: false, error: `ไม่พบรายการที่ต้องการคืน: ${returnLine.lineId}` }
      }
      if (returnLine.qty <= 0) {
        return { success: false, error: 'จำนวนที่คืนต้องมากกว่า 0' }
      }
      if (returnLine.qty > Number(originalLine.qty)) {
        return { success: false, error: `จำนวนที่คืนมากกว่าจำนวนที่เบิก (${originalLine.product.name})` }
      }
    }

    const docNumber = await generateDocNumber('MOVEMENT')

    const returnMovement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: MovementType.RETURN,
        status: DocStatus.DRAFT,
        refType: 'RETURN_FROM',
        refId: issueId,
        note: `คืนของจาก ${issueMovement.docNumber}`,
        reason: 'คืนสินค้าจากการเบิก',
        projectCode: issueMovement.projectCode,
        createdById: session.id,
        lines: {
          create: returnLines.map((returnLine) => {
            const originalLine = issueMovement.lines.find(l => l.id === returnLine.lineId)!
            
            return {
              productId: originalLine.productId,
              variantId: originalLine.variantId || null,
              toLocationId: originalLine.fromLocationId,
              qty: returnLine.qty,
              unitCost: Number(originalLine.unitCost),
              note: `คืนจาก line: ${originalLine.id}`,
              ...(originalLine.lotMovementLines[0] && {
                lotMovementLines: {
                  create: {
                    lotId: originalLine.lotMovementLines[0].lotId,
                    qty: returnLine.qty,
                  },
                },
              }),
            }
          }),
        },
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE_RETURN',
        refType: 'MOVEMENT',
        refId: returnMovement.id,
        newData: { issueMovementId: issueId, issueDocNumber: issueMovement.docNumber },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    revalidatePath(`/movements/${issueId}`)

    return { success: true, data: { id: returnMovement.id } }
  } catch (error) {
    console.error('Create return from issue error:', error)
    return { success: false, error: 'ไม่สามารถสร้างรายการคืนได้' }
  }
}

// ============================================
// Notification Helpers
// ============================================

async function notifyMovementSubmitted(
  movementId: string,
  docNumber: string,
  type: string,
  submitterName: string
) {
  const typeLabel = MOVEMENT_TYPE_LABELS[type] || type
  const prefix = MOVEMENT_NOTIFICATION_PREFIX[type] || 'receive'
  const notificationType = `${prefix}Pending` as NotificationTypeKey

  const approvers = await prisma.user.findMany({
    where: { active: true, deletedAt: null, role: { in: ['ADMIN', 'APPROVER'] } },
    select: { id: true },
  })

  const movement = await prisma.stockMovement.findUnique({
    where: { id: movementId },
    include: { lines: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.movementPending({
    movementId,
    docNumber,
    type: type,
    itemCount: movement?.lines.length || 0,
    requesterName: submitterName,
  }, appUrl)

  await dispatchNotification({
    type: notificationType,
    webType: 'system',
    title: `${typeLabel}รอดำเนินการ: ${docNumber}`,
    message: `${submitterName} ส่งรายการ${typeLabel} ${docNumber} รอดำเนินการ`,
    url: `/movements/${movementId}`,
    lineTemplate,
    targetUserIds: approvers.map((a) => a.id),
  })
}

async function notifyMovementPosted(
  movementId: string,
  docNumber: string,
  type: string,
  creatorId: string
) {
  const typeLabel = MOVEMENT_TYPE_LABELS[type] || type
  const prefix = MOVEMENT_NOTIFICATION_PREFIX[type] || 'receive'
  const notificationType = `${prefix}Posted` as NotificationTypeKey

  const movement = await prisma.stockMovement.findUnique({
    where: { id: movementId },
    include: { createdBy: true, lines: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lineTemplate = NOTIFICATION_TEMPLATES.movementPosted({
    movementId,
    docNumber,
    type: type,
    itemCount: movement?.lines.length || 0,
    requesterName: movement?.createdBy.name || '',
  }, appUrl)

  await dispatchNotification({
    type: notificationType,
    webType: 'system',
    title: `${typeLabel} Posted: ${docNumber}`,
    message: `รายการ${typeLabel} ${docNumber} ถูก Post แล้ว`,
    url: `/movements/${movementId}`,
    lineTemplate,
    targetUserIds: [creatorId],
  })
}
