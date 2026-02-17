'use client'

import dynamic from 'next/dynamic'

const PrintLabel = dynamic(
  () => import('@/components/print-label').then(m => ({ default: m.PrintLabel })),
  { ssr: false }
)

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
