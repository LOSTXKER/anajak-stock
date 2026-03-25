export {
  type VariantOption,
  type Variant,
  type ProductWithVariants,
  type MovementLine,
  createStockMapKey,
  type LocationWithWarehouse,
} from '@/types/product-form'

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

