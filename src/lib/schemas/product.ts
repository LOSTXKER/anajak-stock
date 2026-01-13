/**
 * Product-related Zod schemas
 */

import { z } from 'zod'
import {
  idSchema,
  optionalIdSchema,
  requiredStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  skuSchema,
  priceSchema,
  qtySchema,
  booleanSchema,
} from './common'

// ==================== Product Schemas ====================

export const productSchema = z.object({
  sku: skuSchema,
  name: requiredStringSchema,
  description: optionalStringSchema,
  barcode: optionalStringSchema,
  categoryId: optionalIdSchema,
  unitId: optionalIdSchema,
  reorderPoint: positiveNumberSchema.default(0),
  minQty: positiveNumberSchema.default(0),
  maxQty: positiveNumberSchema.default(0),
  standardCost: priceSchema.default(0),
})

export type ProductInput = z.infer<typeof productSchema>

export const updateProductSchema = productSchema.partial().extend({
  id: idSchema,
})

export type UpdateProductInput = z.infer<typeof updateProductSchema>

// ==================== Category Schemas ====================

export const categorySchema = z.object({
  name: requiredStringSchema,
  description: optionalStringSchema,
})

export type CategoryInput = z.infer<typeof categorySchema>

export const updateCategorySchema = categorySchema.partial().extend({
  id: idSchema,
})

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

// ==================== Unit of Measure Schemas ====================

export const unitSchema = z.object({
  name: requiredStringSchema,
  symbol: requiredStringSchema,
})

export type UnitInput = z.infer<typeof unitSchema>

// ==================== Option Type Schemas ====================

export const optionTypeSchema = z.object({
  name: requiredStringSchema,
  displayOrder: positiveNumberSchema.default(0),
})

export type OptionTypeInput = z.infer<typeof optionTypeSchema>

export const optionValueSchema = z.object({
  optionTypeId: idSchema,
  value: requiredStringSchema,
  displayOrder: positiveNumberSchema.default(0),
})

export type OptionValueInput = z.infer<typeof optionValueSchema>

// ==================== Variant Schemas ====================

export const variantSchema = z.object({
  productId: idSchema,
  sku: skuSchema,
  name: optionalStringSchema,
  costPrice: priceSchema.default(0),
  sellingPrice: priceSchema.default(0),
  reorderPoint: positiveNumberSchema.default(0),
  minQty: positiveNumberSchema.default(0),
  maxQty: positiveNumberSchema.default(0),
  lowStockAlert: booleanSchema.default(true),
  optionValueIds: z.array(idSchema).optional(),
})

export type VariantInput = z.infer<typeof variantSchema>

export const updateVariantSchema = variantSchema.partial().extend({
  id: idSchema,
})

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>

// ==================== Inline Variant Creation ====================

export const inlineOptionSchema = z.object({
  id: z.string(), // Temporary ID for inline creation
  name: requiredStringSchema,
  values: z.array(z.object({
    id: z.string(),
    value: requiredStringSchema,
  })),
})

export const inlineVariantSchema = z.object({
  sku: skuSchema,
  costPrice: priceSchema.default(0),
  sellingPrice: priceSchema.default(0),
  reorderPoint: positiveNumberSchema.default(0),
  stock: qtySchema.default(0),
  optionValues: z.array(z.object({
    optionId: z.string(),
    valueId: z.string(),
  })),
})

export const productWithVariantsSchema = productSchema.extend({
  hasVariants: booleanSchema.default(false),
  options: z.array(inlineOptionSchema).optional(),
  variants: z.array(inlineVariantSchema).optional(),
})

export type ProductWithVariantsInput = z.infer<typeof productWithVariantsSchema>
