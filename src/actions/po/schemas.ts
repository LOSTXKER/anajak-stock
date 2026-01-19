/**
 * PO-related schemas and types
 */

import { VatType } from '@/generated/prisma'

export interface POLineInput {
  productId: string
  variantId?: string
  qty: number
  unitPrice: number
  note?: string
}

export interface CreatePOInput {
  supplierId: string
  prId?: string
  vatType?: VatType
  vatRate?: number
  eta?: Date
  terms?: string
  note?: string
  lines: POLineInput[]
}

export interface GRNLineInput {
  poLineId: string
  productId: string
  variantId?: string
  locationId?: string
  qtyReceived: number
  unitCost: number
  note?: string
}

export interface CreateGRNInput {
  poId: string
  note?: string
  lines: GRNLineInput[]
}
