'use client'

import { Users, CheckCircle2, Shield } from 'lucide-react'
import { StatCard } from '@/components/common'

interface UsersStatsProps {
  total: number
  active: number
  admins: number
}

export function UsersStats({ total, active, admins }: UsersStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title="ผู้ใช้ทั้งหมด"
        value={total}
        icon={Users}
        variant="info"
      />
      <StatCard
        title="ใช้งานอยู่"
        value={active}
        icon={CheckCircle2}
        variant="success"
      />
      <StatCard
        title="Admins"
        value={admins}
        icon={Shield}
        variant="error"
      />
    </div>
  )
}
