/**
 * Variant-related Zod schemas
 */

import { z } from 'zod'
import { StockType, ItemType } from '@/generated/prisma'

// ==================== SCHEMAS ====================

export const VariantInputSchema = z.object({
  sku: z.string().min(1, 'กรุณากรอก SKU'),
  barcode: z.string().optional(),
  name: z.string().optional(),
  stockType: z.nativeEnum(StockType).default(StockType.STOCKED),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(0),
  minQty: z.number().min(0).default(0),
  maxQty: z.number().min(0).default(0),
  lowStockAlert: z.boolean().default(true),
  optionValueIds: z.array(z.string()),
})

export const UpdateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  name: z.string().optional(),
  stockType: z.nativeEnum(StockType).optional(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  reorderPoint: z.number().min(0).optional(),
  minQty: z.number().min(0).optional(),
  maxQty: z.number().min(0).optional(),
  lowStockAlert: z.boolean().optional(),
  optionValueIds: z.array(z.string()).optional(),
})

export const CreateProductWithVariantsSchema = z.object({
  // Product fields
  sku: z.string().min(1, 'กรุณากรอก SKU'),
  name: z.string().min(1, 'กรุณากรอกชื่อสินค้า'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  itemType: z.nativeEnum(ItemType).default(ItemType.FINISHED_GOOD),
  reorderPoint: z.number().min(0).default(0),
  minQty: z.number().min(0).default(0),
  maxQty: z.number().min(0).default(0),
  standardCost: z.number().min(0).default(0),
  // Variants
  variants: z.array(VariantInputSchema).min(1, 'กรุณาเพิ่มอย่างน้อย 1 variant'),
})

export const InlineVariantInputSchema = z.object({
  sku: z.string().min(1, 'กรุณากรอก SKU'),
  barcode: z.string().optional(),
  stockType: z.nativeEnum(StockType).default(StockType.STOCKED),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(0),
  minQty: z.number().min(0).default(0),
  maxQty: z.number().min(0).default(0),
  lowStockAlert: z.boolean().default(true),
  options: z.array(z.object({
    groupName: z.string(),
    value: z.string(),
  })),
})

export const CreateProductWithInlineVariantsSchema = z.object({
  // Product fields
  sku: z.string().min(1, 'กรุณากรอก SKU'),
  name: z.string().min(1, 'กรุณากรอกชื่อสินค้า'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  itemType: z.nativeEnum(ItemType).default(ItemType.FINISHED_GOOD),
  reorderPoint: z.number().min(0).default(0),
  minQty: z.number().min(0).default(0),
  maxQty: z.number().min(0).default(0),
  standardCost: z.number().min(0).default(0),
  // Inline option groups
  optionGroups: z.array(z.object({
    name: z.string().min(1),
    values: z.array(z.string().min(1)),
  })).min(1, 'กรุณาเพิ่มอย่างน้อย 1 กลุ่มตัวเลือก'),
  // Variants
  variants: z.array(InlineVariantInputSchema).min(1, 'กรุณาเพิ่มอย่างน้อย 1 variant'),
  // Initial stock (optional)
  initialStock: z.object({
    locationId: z.string().min(1),
    note: z.string().optional(),
    items: z.array(z.object({
      sku: z.string(),
      qty: z.number().min(1),
    })),
  }).optional(),
})

// Type exports
export type VariantInput = z.infer<typeof VariantInputSchema>
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>
export type CreateProductWithVariantsInput = z.infer<typeof CreateProductWithVariantsSchema>
export type InlineVariantInput = z.infer<typeof InlineVariantInputSchema>
export type CreateProductWithInlineVariantsInput = z.infer<typeof CreateProductWithInlineVariantsSchema>
