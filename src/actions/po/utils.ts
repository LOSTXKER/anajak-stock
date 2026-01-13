/**
 * PO utility functions (non-async, not server actions)
 */

import { VatType } from '@/generated/prisma'
import type { POLineInput } from './schemas'

/**
 * Calculate PO totals with VAT
 */
export function calculatePOTotals(lines: POLineInput[], vatType: VatType, vatRate: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  let vatAmount = 0
  let total = subtotal

  if (vatType === VatType.EXCLUDED) {
    vatAmount = subtotal * (vatRate / 100)
    total = subtotal + vatAmount
  } else if (vatType === VatType.INCLUDED) {
    vatAmount = subtotal - subtotal / (1 + vatRate / 100)
    total = subtotal
  }

  return { subtotal, vatAmount, total }
}
