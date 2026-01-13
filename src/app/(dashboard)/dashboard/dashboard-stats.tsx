'use client'

import { Package, Warehouse, AlertTriangle, TrendingUp, FileText, ShoppingCart, ClipboardList } from 'lucide-react'
import { StatCard } from '@/components/common'

interface DashboardStatsProps {
  stats: {
    totalProducts: number
    totalLocations: number
    lowStockCount: number
    todayMovements: number
    pendingPRs: number
    pendingPOs: number
    totalStockQty: number
  }
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="สินค้าทั้งหมด"
          value={stats.totalProducts}
          icon={Package}
          href="/products"
        />
        <StatCard
          title="โลเคชันคลัง"
          value={stats.totalLocations}
          icon={Warehouse}
          href="/stock"
        />
        <StatCard
          title="สินค้าใกล้หมด"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          variant="warning"
          href="/reports/low-stock"
        />
        <StatCard
          title="เคลื่อนไหววันนี้"
          value={stats.todayMovements}
          icon={TrendingUp}
          variant="success"
          href="/movements"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="PR รออนุมัติ"
          value={stats.pendingPRs}
          icon={FileText}
          variant="info"
          href="/pr"
        />
        <StatCard
          title="PO กำลังดำเนินการ"
          value={stats.pendingPOs}
          icon={ShoppingCart}
          variant="info"
          href="/po"
        />
        <StatCard
          title="สต๊อครวม"
          value={stats.totalStockQty}
          icon={ClipboardList}
          href="/stock"
        />
      </div>
    </>
  )
}
