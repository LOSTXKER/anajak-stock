'use client'

import { PrintLabel } from '@/components/print-label'

interface PrintLabelButtonProps {
  product: {
    sku: string
    name: string
    barcode?: string | null
    price?: number | null
    unit?: string | null
  }
}

export function PrintLabelButton({ product }: PrintLabelButtonProps) {
  return <PrintLabel product={product} />
}
