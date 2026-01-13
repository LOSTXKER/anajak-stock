/**
 * Variant utility functions (non-async, not server actions)
 */

/**
 * Generate SKU for a variant based on parent SKU and option values
 */
export function generateVariantSku(parentSku: string, optionLabels: string[]): string {
  const suffix = optionLabels.join('-')
  return `${parentSku}-${suffix}`
}
