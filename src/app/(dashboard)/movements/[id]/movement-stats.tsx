'use client'

import { User, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import { StatCard } from '@/components/common'

interface MovementStatsProps {
  createdByName: string | null
  createdAt: Date
  totalQty: number
  linesCount: number
  approvedByName?: string | null
  postedAt?: Date | null
}

export function MovementStats({
  createdByName,
  createdAt,
  totalQty,
  linesCount,
  approvedByName,
  postedAt,
}: MovementStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        title="ผู้สร้าง"
        value={createdByName || '-'}
        icon={User}
        variant="info"
      />
      <StatCard
        title="วันที่เอกสาร"
        value={new Date(createdAt).toLocaleDateString('th-TH')}
        icon={Calendar}
        variant="warning"
      />
      <StatCard
        title="จำนวนรวม"
        value={totalQty.toLocaleString()}
        subtitle={`${linesCount} รายการ`}
        icon={FileText}
        variant="primary"
      />
      {approvedByName && (
        <StatCard
          title="ผู้อนุมัติ"
          value={approvedByName}
          subtitle={postedAt ? new Date(postedAt).toLocaleDateString('th-TH') : undefined}
          icon={CheckCircle2}
          variant="success"
        />
      )}
    </div>
  )
}
