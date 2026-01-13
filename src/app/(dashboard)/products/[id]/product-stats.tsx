'use client'

import { Package, DollarSign, AlertTriangle, TrendingUp, Layers, MapPin } from 'lucide-react'
import { StatCard } from '@/components/common'

interface ProductStatsProps {
  totalStock: number
  totalValue: number
  unit: string
  standardCost: number
  reorderPoint: number
  isBelowReorderPoint: boolean
  hasVariants: boolean
  variantCount: number
  locationCount: number
}

export function ProductStats({
  totalStock,
  totalValue,
  unit,
  standardCost,
  reorderPoint,
  isBelowReorderPoint,
  hasVariants,
  variantCount,
  locationCount,
}: ProductStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        title="จำนวนคงเหลือ"
        value={totalStock.toLocaleString()}
        subtitle={unit}
        icon={Package}
        variant="primary"
      />
      <StatCard
        title="มูลค่าสต๊อค"
        value={`฿${totalValue.toLocaleString()}`}
        subtitle={`ต้นทุน ฿${standardCost.toLocaleString()}/ชิ้น`}
        icon={DollarSign}
        variant="success"
      />
      <StatCard
        title="Reorder Point"
        value={reorderPoint.toLocaleString()}
        subtitle={isBelowReorderPoint ? 'ต่ำกว่า ROP' : 'ปกติ'}
        icon={isBelowReorderPoint ? AlertTriangle : TrendingUp}
        variant={isBelowReorderPoint ? 'warning' : 'default'}
      />
      <StatCard
        title={hasVariants ? 'จำนวน Variants' : 'จำนวน Locations'}
        value={hasVariants ? variantCount : locationCount}
        icon={hasVariants ? Layers : MapPin}
      />
    </div>
  )
}
