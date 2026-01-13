'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleActionError } from '@/lib/action-utils'
import type { ActionResult } from '@/types'

interface VariantCombination {
  sku: string
  optionValueIds: string[]
  optionLabels: string[]
}

/**
 * Generate all possible variant combinations from selected options
 */
export async function generateVariantCombinations(
  selectedOptions: { optionTypeId: string; valueIds: string[] }[]
): Promise<ActionResult<VariantCombination[]>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    // Get option values with their types
    const allValueIds = selectedOptions.flatMap(o => o.valueIds)
    const optionValues = await prisma.optionValue.findMany({
      where: { id: { in: allValueIds } },
      include: { optionType: true },
    })

    // Group values by option type
    const valuesByType: Record<string, { id: string; value: string; typeName: string }[]> = {}
    for (const option of selectedOptions) {
      const typeValues = optionValues.filter(ov => option.valueIds.includes(ov.id))
      if (typeValues.length > 0) {
        valuesByType[option.optionTypeId] = typeValues.map(ov => ({
          id: ov.id,
          value: ov.value,
          typeName: ov.optionType.name,
        }))
      }
    }

    // Generate combinations
    const typeIds = Object.keys(valuesByType)
    if (typeIds.length === 0) {
      return { success: true, data: [] }
    }

    const combinations: VariantCombination[] = []

    function generateCombos(index: number, current: { id: string; value: string }[]) {
      if (index === typeIds.length) {
        const optionValueIds = current.map(c => c.id)
        const optionLabels = current.map(c => c.value)
        const skuSuffix = optionLabels.join('-')
        combinations.push({
          sku: skuSuffix,
          optionValueIds,
          optionLabels,
        })
        return
      }

      const typeId = typeIds[index]
      for (const value of valuesByType[typeId]) {
        generateCombos(index + 1, [...current, value])
      }
    }

    generateCombos(0, [])

    return { success: true, data: combinations }
  } catch (error) {
    return handleActionError(error, 'generateVariantCombinations')
  }
}

/**
 * Check if variant SKU already exists
 */
export async function checkVariantSkuExists(sku: string): Promise<ActionResult<boolean>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const existing = await prisma.productVariant.findUnique({
      where: { sku },
    })

    return { success: true, data: !!existing }
  } catch (error) {
    return handleActionError(error, 'checkVariantSkuExists')
  }
}

/**
 * Get option types with their values for variant selection
 */
export async function getOptionTypesWithValues() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'ไม่ได้รับอนุญาต' }
  }

  try {
    const optionTypes = await prisma.optionType.findMany({
      include: {
        values: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return { success: true as const, data: optionTypes }
  } catch (error) {
    console.error('Get option types error:', error)
    return { success: false as const, error: 'ไม่สามารถดึงข้อมูลประเภทตัวเลือกได้' }
  }
}
