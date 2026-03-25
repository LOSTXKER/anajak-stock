'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { DocStatus } from '@/generated/prisma'
import type { ActionResult, MovementWithRelations } from '@/types'
import type { CreateMovementInput } from './shared'
import { generateDocNumber } from './shared'

export async function createMovement(data: CreateMovementInput): Promise<ActionResult<MovementWithRelations>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  if (!data.lines || data.lines.length === 0) {
    return { success: false, error: 'กรุณาเพิ่มรายการสินค้า' }
  }

  try {
    const docNumber = await generateDocNumber('MOVEMENT')

    const lotIdMap = new Map<number, string>()
    
    if (data.type === 'RECEIVE') {
      const linesWithNewLot = data.lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.newLotNumber && !line.lotId)

      if (linesWithNewLot.length > 0) {
        const lotKeys = linesWithNewLot.map(({ line }) => ({
          lotNumber: line.newLotNumber!,
          productId: line.productId,
        }))

        const existingLots = await prisma.lot.findMany({
          where: {
            OR: lotKeys.map(k => ({
              lotNumber: k.lotNumber,
              productId: k.productId,
            })),
          },
        })

        const existingLotMap = new Map(
          existingLots.map(lot => [`${lot.productId}:${lot.lotNumber}`, lot.id])
        )

        const linesToCreateLot: Array<{
          index: number
          lotNumber: string
          productId: string
          variantId: string | null
          expiryDate: Date | null
          qty: number
        }> = []

        for (const { line, index } of linesWithNewLot) {
          const key = `${line.productId}:${line.newLotNumber}`
          const existingLotId = existingLotMap.get(key)
          
          if (existingLotId) {
            lotIdMap.set(index, existingLotId)
          } else {
            linesToCreateLot.push({
              index,
              lotNumber: line.newLotNumber!,
              productId: line.productId,
              variantId: line.variantId || null,
              expiryDate: line.newLotExpiryDate ? new Date(line.newLotExpiryDate) : null,
              qty: line.qty,
            })
          }
        }

        if (linesToCreateLot.length > 0) {
          const uniqueLotsToCreate = new Map<string, typeof linesToCreateLot[0]>()
          for (const lot of linesToCreateLot) {
            const key = `${lot.productId}:${lot.lotNumber}`
            if (!uniqueLotsToCreate.has(key)) {
              uniqueLotsToCreate.set(key, lot)
            }
          }

          await prisma.lot.createMany({
            data: [...uniqueLotsToCreate.values()].map(lot => ({
              lotNumber: lot.lotNumber,
              productId: lot.productId,
              variantId: lot.variantId,
              expiryDate: lot.expiryDate,
              qtyReceived: lot.qty,
            })),
            skipDuplicates: true,
          })

          const newLots = await prisma.lot.findMany({
            where: {
              OR: [...uniqueLotsToCreate.values()].map(lot => ({
                lotNumber: lot.lotNumber,
                productId: lot.productId,
              })),
            },
          })

          const newLotMap = new Map(
            newLots.map(lot => [`${lot.productId}:${lot.lotNumber}`, lot.id])
          )

          for (const lot of linesToCreateLot) {
            const key = `${lot.productId}:${lot.lotNumber}`
            const lotId = newLotMap.get(key)
            if (lotId) {
              lotIdMap.set(lot.index, lotId)
            }
          }
        }
      }
    }

    const movement = await prisma.stockMovement.create({
      data: {
        docNumber,
        type: data.type,
        status: DocStatus.DRAFT,
        note: data.note,
        reason: data.reason,
        projectCode: data.projectCode,
        refType: data.refType,
        refId: data.refId,
        createdById: session.id,
        lines: {
          create: data.lines.map((line, index) => {
            const lotId = line.lotId || lotIdMap.get(index)
            return {
              productId: line.productId,
              variantId: line.variantId || null,
              fromLocationId: line.fromLocationId || null,
              toLocationId: line.toLocationId || null,
              qty: line.qty,
              unitCost: line.unitCost || 0,
              note: line.note,
              orderRef: line.orderRef || null,
              ...(lotId && {
                lotMovementLines: {
                  create: {
                    lotId: lotId,
                    qty: line.qty,
                  },
                },
              }),
            }
          }),
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true, supabaseId: true, customPermissions: true },
        },
        approvedBy: {
          select: { id: true, name: true, username: true, role: true, email: true, active: true, createdAt: true, updatedAt: true, deletedAt: true, supabaseId: true, customPermissions: true },
        },
        lines: {
          include: {
            product: true,
            fromLocation: { include: { warehouse: true } },
            toLocation: { include: { warehouse: true } },
          },
        },
      },
    })

    prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'MOVEMENT',
        refId: movement.id,
        newData: { docNumber, type: data.type },
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    revalidatePath('/movements')
    return { success: true, data: movement as unknown as MovementWithRelations }
  } catch (error) {
    console.error('Create movement error:', error)
    return { success: false, error: 'ไม่สามารถสร้างรายการเคลื่อนไหวได้' }
  }
}
