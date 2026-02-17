import { prisma } from '@/lib/prisma'

export interface MovementLineInput {
  productId: string
  variantId?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost?: number
  note?: string
  lotId?: string
  newLotNumber?: string
  newLotExpiryDate?: string
  orderRef?: string
}

export interface CreateMovementInput {
  type: import('@/generated/prisma').MovementType
  note?: string
  reason?: string
  projectCode?: string
  refType?: string
  refId?: string
  lines: MovementLineInput[]
}

export interface UpdateMovementLineInput {
  id?: string
  productId: string
  variantId?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost?: number
  note?: string
  orderRef?: string
}

export interface UpdateMovementInput {
  note?: string
  reason?: string
  projectCode?: string
  lines: UpdateMovementLineInput[]
}

interface ReturnLineInput {
  lineId: string
  qty: number
}

export type { ReturnLineInput }

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  RECEIVE: 'รับเข้า',
  ISSUE: 'เบิกออก',
  TRANSFER: 'โอนย้าย',
  ADJUST: 'ปรับปรุง',
  RETURN: 'คืนของ',
}

export const MOVEMENT_NOTIFICATION_PREFIX: Record<string, string> = {
  RECEIVE: 'receive',
  ISSUE: 'issue',
  TRANSFER: 'transfer',
  ADJUST: 'adjust',
  RETURN: 'return',
}

export async function generateDocNumber(type: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.docSequence.update({
      where: { docType: type === 'MOVEMENT' ? 'MOVEMENT' : type },
      data: { currentNo: { increment: 1 } },
    })

    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const num = sequence.currentNo.toString().padStart(sequence.padLength, '0')

    return `${sequence.prefix}${year}${month}-${num}`
  })

  return result
}
