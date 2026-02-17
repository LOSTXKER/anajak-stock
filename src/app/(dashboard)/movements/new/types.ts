import type { ProductWithRelations, LocationWithWarehouse } from '@/types'

export interface VariantOption {
  optionName: string
  value: string
}

export interface Variant {
  id: string
  sku: string
  name: string | null
  options: VariantOption[]
  stock?: number
  costPrice?: number
}

export interface ProductWithVariants extends ProductWithRelations {
  hasVariants: boolean
  variants?: Variant[]
}

export interface MovementLine {
  id: string
  productId: string
  variantId?: string
  productName?: string
  variantLabel?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost: number
  note?: string
  lotId?: string
  lotNumber?: string
  newLotNumber?: string
  newExpiryDate?: string
  newQty?: number
  issuedQty?: number
  returnedQty?: number
  remainingQty?: number
  orderRef?: string
}

export interface IssuedMovementSummary {
  id: string
  docNumber: string
  note: string | null
  createdAt: Date
  postedAt: Date | null
  createdBy: { id: string; name: string }
  lines: Array<{
    id: string
    productId: string
    productName: string
    productSku: string
    variantId: string | null
    variantName: string | null
    variantSku: string | null
    fromLocationId: string | null
    fromLocationCode: string | null
    fromWarehouseName: string | null
    issuedQty: number
    returnedQty: number
    remainingQty: number
  }>
}

export function createStockMapKey(productId: string, variantId: string | null, locationId: string): string {
  return `${productId}|${variantId || ''}|${locationId}`
}

export type { LocationWithWarehouse }
