/**
 * Lot-related Zod schemas
 */

import { z } from 'zod'

export const CreateLotSchema = z.object({
  lotNumber: z.string().min(1, 'กรุณากรอกหมายเลข Lot'),
  productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
  variantId: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  manufacturedDate: z.string().optional().nullable(),
  qtyReceived: z.number().min(0),
  note: z.string().optional(),
})

export const UpdateLotSchema = z.object({
  expiryDate: z.string().optional().nullable(),
  manufacturedDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export type CreateLotInput = z.infer<typeof CreateLotSchema>
export type UpdateLotInput = z.infer<typeof UpdateLotSchema>
