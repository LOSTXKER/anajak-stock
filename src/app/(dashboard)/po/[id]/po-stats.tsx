'use client'

import { Building2, DollarSign, Calendar } from 'lucide-react'
import { StatCard } from '@/components/common'
import { formatDate } from '@/lib/date'

interface POStatsProps {
  supplierName: string
  totalAmount: number
  vatType: string
  eta: Date | null
}

export function POStats({
  supplierName,
  totalAmount,
  vatType,
  eta,
}: POStatsProps) {
  const vatLabel = vatType === 'INCLUDED' ? 'รวม VAT' : vatType === 'EXCLUDED' ? 'ไม่รวม VAT' : ''

  return (
    <>
      <StatCard
        title="Supplier"
        value={supplierName}
        icon={Building2}
        variant="info"
      />
      <StatCard
        title="มูลค่ารวม"
        value={`฿${totalAmount.toLocaleString()}`}
        subtitle={vatLabel}
        icon={DollarSign}
        variant="success"
      />
      <StatCard
        title="กำหนดส่ง"
        value={formatDate(eta)}
        icon={Calendar}
        variant="warning"
      />
    </>
  )
}
