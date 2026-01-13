'use server'

import { prisma } from '@/lib/prisma'

/**
 * Generate PO document number
 */
export async function generatePONumber(): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.docSequence.update({
      where: { docType: 'PO' },
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

/**
 * Generate GRN document number
 */
export async function generateGRNNumber(): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.docSequence.update({
      where: { docType: 'GRN' },
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

/**
 * Get all suppliers
 */
export async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { name: 'asc' },
  })
}
