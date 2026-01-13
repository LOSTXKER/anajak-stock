/**
 * Common Zod schemas used across the application
 */

import { z } from 'zod'

// ==================== ID Schemas ====================

export const idSchema = z.string().min(1, 'กรุณาระบุ ID')
export const cuidSchema = z.string().cuid('ID ไม่ถูกต้อง')
export const optionalIdSchema = z.string().optional()

// ==================== Pagination Schemas ====================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
})

export type PaginationInput = z.infer<typeof paginationSchema>

// ==================== Date Schemas ====================

export const dateSchema = z.coerce.date()
export const optionalDateSchema = z.coerce.date().optional()

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' }
)

export type DateRangeInput = z.infer<typeof dateRangeSchema>

// ==================== Number Schemas ====================

export const positiveNumberSchema = z.coerce.number().min(0, 'ต้องเป็นจำนวนบวก')
export const positiveIntegerSchema = z.coerce.number().int().min(0, 'ต้องเป็นจำนวนเต็มบวก')
export const priceSchema = z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ')
export const qtySchema = z.coerce.number().min(0, 'จำนวนต้องไม่ติดลบ')

// ==================== String Schemas ====================

export const requiredStringSchema = z.string().min(1, 'กรุณากรอกข้อมูล')
export const optionalStringSchema = z.string().optional()
export const emailSchema = z.string().email('อีเมลไม่ถูกต้อง')
export const phoneSchema = z.string().regex(/^[0-9]{9,10}$/, 'เบอร์โทรศัพท์ไม่ถูกต้อง').optional()

// SKU format: alphanumeric with dashes
export const skuSchema = z
  .string()
  .min(1, 'กรุณากรอก SKU')
  .regex(/^[A-Za-z0-9-]+$/, 'SKU ต้องเป็นตัวอักษร ตัวเลข หรือ - เท่านั้น')

// ==================== Boolean Schemas ====================

export const booleanSchema = z.coerce.boolean()
export const optionalBooleanSchema = z.coerce.boolean().optional()

// ==================== Filter Schemas ====================

export const baseFilterSchema = z.object({
  search: z.string().optional(),
  active: z.coerce.boolean().optional().default(true),
})

export const warehouseFilterSchema = baseFilterSchema.extend({
  warehouseId: z.string().optional(),
})

export const categoryFilterSchema = baseFilterSchema.extend({
  categoryId: z.string().optional(),
})

// ==================== Status Schemas ====================

export const docStatusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED'])
export const prStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'])
export const poStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'])
export const grnStatusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED'])
export const movementTypeSchema = z.enum(['RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUST'])

// ==================== Note Schema ====================

export const noteSchema = z.string().max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร').optional()
