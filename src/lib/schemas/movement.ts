/**
 * Stock movement related Zod schemas
 */

import { z } from 'zod'
import {
  idSchema,
  optionalIdSchema,
  requiredStringSchema,
  optionalStringSchema,
  qtySchema,
  priceSchema,
  noteSchema,
  movementTypeSchema,
} from './common'

// ==================== Movement Line Schemas ====================

export const movementLineSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  fromLocationId: optionalIdSchema,
  toLocationId: optionalIdSchema,
  qty: qtySchema.min(0.0001, 'จำนวนต้องมากกว่า 0'),
  unitCost: priceSchema.default(0),
  note: noteSchema,
})

export type MovementLineInput = z.infer<typeof movementLineSchema>

// ==================== Stock Movement Schemas ====================

export const createMovementSchema = z.object({
  type: movementTypeSchema,
  refNumber: optionalStringSchema,
  note: noteSchema,
  lines: z.array(movementLineSchema).min(1, 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ'),
})

export type CreateMovementInput = z.infer<typeof createMovementSchema>

// Validation for movement types
export const receiveMovementSchema = createMovementSchema.extend({
  type: z.literal('RECEIVE'),
}).refine(
  (data) => data.lines.every((line) => line.toLocationId),
  { message: 'การรับสินค้าต้องระบุ Location ปลายทาง' }
)

export const issueMovementSchema = createMovementSchema.extend({
  type: z.literal('ISSUE'),
}).refine(
  (data) => data.lines.every((line) => line.fromLocationId),
  { message: 'การเบิกสินค้าต้องระบุ Location ต้นทาง' }
)

export const transferMovementSchema = createMovementSchema.extend({
  type: z.literal('TRANSFER'),
}).refine(
  (data) => data.lines.every((line) => line.fromLocationId && line.toLocationId),
  { message: 'การโอนย้ายต้องระบุทั้ง Location ต้นทางและปลายทาง' }
)

export const adjustMovementSchema = createMovementSchema.extend({
  type: z.literal('ADJUST'),
}).refine(
  (data) => data.lines.every((line) => line.toLocationId),
  { message: 'การปรับปรุงสต๊อคต้องระบุ Location' }
)

// ==================== Stock Balance Schemas ====================

export const stockBalanceFilterSchema = z.object({
  warehouseId: optionalIdSchema,
  locationId: optionalIdSchema,
  categoryId: optionalIdSchema,
  productId: optionalIdSchema,
  lowStockOnly: z.coerce.boolean().optional().default(false),
  search: optionalStringSchema,
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type StockBalanceFilterInput = z.infer<typeof stockBalanceFilterSchema>

// ==================== Stock Take Schemas ====================

export const stockTakeSchema = z.object({
  warehouseId: idSchema,
  note: noteSchema,
})

export type StockTakeInput = z.infer<typeof stockTakeSchema>

export const stockTakeLineUpdateSchema = z.object({
  lineId: idSchema,
  countedQty: qtySchema,
  note: noteSchema,
})

export type StockTakeLineUpdateInput = z.infer<typeof stockTakeLineUpdateSchema>

// ==================== Lot Schemas ====================

export const lotSchema = z.object({
  lotNumber: requiredStringSchema,
  productId: idSchema,
  variantId: optionalIdSchema,
  expiryDate: z.coerce.date().optional(),
  manufacturedDate: z.coerce.date().optional(),
  qtyReceived: qtySchema.min(0.0001, 'จำนวนต้องมากกว่า 0'),
  note: noteSchema,
})

export type LotInput = z.infer<typeof lotSchema>

export const updateLotSchema = lotSchema.partial().extend({
  id: idSchema,
})

export type UpdateLotInput = z.infer<typeof updateLotSchema>
