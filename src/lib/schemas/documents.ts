/**
 * Document-related Zod schemas (PR, PO, GRN)
 */

import { z } from 'zod'
import {
  idSchema,
  optionalIdSchema,
  optionalStringSchema,
  qtySchema,
  priceSchema,
  noteSchema,
  optionalDateSchema,
} from './common'

// ==================== PR Line Schemas ====================

export const prLineSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  qty: qtySchema.min(0.0001, 'จำนวนต้องมากกว่า 0'),
  estimatedPrice: priceSchema.default(0),
  note: noteSchema,
})

export type PRLineInput = z.infer<typeof prLineSchema>

// ==================== PR Schemas ====================

export const createPRSchema = z.object({
  note: noteSchema,
  lines: z.array(prLineSchema).min(1, 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ'),
})

export type CreatePRInput = z.infer<typeof createPRSchema>

export const updatePRSchema = createPRSchema.partial().extend({
  id: idSchema,
})

export type UpdatePRInput = z.infer<typeof updatePRSchema>

export const approvePRSchema = z.object({
  id: idSchema,
  approved: z.boolean(),
  note: noteSchema,
})

export type ApprovePRInput = z.infer<typeof approvePRSchema>

// ==================== PO Line Schemas ====================

export const poLineSchema = z.object({
  productId: idSchema,
  variantId: optionalIdSchema,
  qty: qtySchema.min(0.0001, 'จำนวนต้องมากกว่า 0'),
  unitPrice: priceSchema.min(0, 'ราคาต้องไม่ติดลบ'),
  discount: priceSchema.default(0),
  note: noteSchema,
})

export type POLineInput = z.infer<typeof poLineSchema>

// ==================== PO Schemas ====================

export const createPOSchema = z.object({
  supplierId: idSchema,
  prId: optionalIdSchema,
  eta: optionalDateSchema,
  paymentTerms: optionalStringSchema,
  deliveryTerms: optionalStringSchema,
  note: noteSchema,
  lines: z.array(poLineSchema).min(1, 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ'),
})

export type CreatePOInput = z.infer<typeof createPOSchema>

export const updatePOSchema = createPOSchema.partial().extend({
  id: idSchema,
})

export type UpdatePOInput = z.infer<typeof updatePOSchema>

export const approvePOSchema = z.object({
  id: idSchema,
  approved: z.boolean(),
  note: noteSchema,
})

export type ApprovePOInput = z.infer<typeof approvePOSchema>

// ==================== GRN Line Schemas ====================

export const grnLineSchema = z.object({
  poLineId: idSchema,
  productId: idSchema,
  variantId: optionalIdSchema,
  locationId: idSchema,
  qty: qtySchema.min(0.0001, 'จำนวนต้องมากกว่า 0'),
  note: noteSchema,
  // Lot tracking fields
  lotNumber: optionalStringSchema,
  expiryDate: optionalDateSchema,
})

export type GRNLineInput = z.infer<typeof grnLineSchema>

// ==================== GRN Schemas ====================

export const createGRNSchema = z.object({
  poId: idSchema,
  invoiceNumber: optionalStringSchema,
  note: noteSchema,
  lines: z.array(grnLineSchema).min(1, 'ต้องมีรายการรับสินค้าอย่างน้อย 1 รายการ'),
})

export type CreateGRNInput = z.infer<typeof createGRNSchema>

// ==================== Supplier Schemas ====================

export const supplierSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ Supplier'),
  contactPerson: optionalStringSchema,
  email: z.string().email('อีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  phone: optionalStringSchema,
  address: optionalStringSchema,
  taxId: optionalStringSchema,
  paymentTerms: optionalStringSchema,
  leadTime: z.coerce.number().min(0).optional(),
  note: noteSchema,
})

export type SupplierInput = z.infer<typeof supplierSchema>

export const updateSupplierSchema = supplierSchema.partial().extend({
  id: idSchema,
})

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
