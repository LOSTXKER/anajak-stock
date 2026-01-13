'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Truck, Download, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { getSupplierLeadTime } from '@/actions/reports'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface SupplierLeadTimeItem {
  supplierId: string
  supplierName: string
  poCount: number
  avgLeadTime: number
  minLeadTime: number
  maxLeadTime: number
}

const COLORS = [
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

export default function SupplierLeadTimePage() {
  const [data, setData] = useState<SupplierLeadTimeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getSupplierLeadTime()
        if (result.success) {
          setData(result.data)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const totalPOs = data.reduce((sum, item) => sum + item.poCount, 0)
  const avgLeadTimeAll = data.length > 0
    ? Math.round(data.reduce((sum, item) => sum + item.avgLeadTime * item.poCount, 0) / totalPOs)
    : 0
  const fastestSupplier = data[0]
  const slowestSupplier = data[data.length - 1]

  const chartData = data.map((item, index) => ({
    name: item.supplierName.length > 15 ? item.supplierName.substring(0, 15) + '...' : item.supplierName,
    fullName: item.supplierName,
    avgDays: item.avgLeadTime,
    color: COLORS[index % COLORS.length],
  }))

  const getPerformanceColor = (days: number) => {
    if (days <= 3) return 'bg-[var(--status-success-light)] text-[var(--status-success)] border-[var(--status-success)]/30'
    if (days <= 7) return 'bg-[var(--status-info-light)] text-[var(--status-info)] border-[var(--status-info)]/30'
    if (days <= 14) return 'bg-[var(--status-warning-light)] text-[var(--status-warning)] border-[var(--status-warning)]/30'
    return 'bg-[var(--status-error-light)] text-[var(--status-error)] border-[var(--status-error)]/30'
  }

  const getPerformanceLabel = (days: number) => {
    if (days <= 3) return 'ดีเยี่ยม'
    if (days <= 7) return 'ดี'
    if (days <= 14) return 'พอใช้'
    return 'ช้า'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="w-6 h-6 text-[var(--accent-primary)]" />
            Supplier Lead Time
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            ระยะเวลาเฉลี่ยจากการสั่งซื้อถึงการรับของ
          </p>
        </div>
        <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Truck className="w-4 h-4 text-[var(--accent-primary)]" />
              จำนวน Supplier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{data.length}</div>
            <p className="text-[var(--text-muted)] text-sm">ที่มีประวัติส่งของ</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--status-info)]" />
              Lead Time เฉลี่ย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{avgLeadTimeAll} วัน</div>
            <p className="text-[var(--text-muted)] text-sm">จาก {totalPOs} PO</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--status-success)]" />
              เร็วที่สุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-[var(--text-primary)] truncate">
              {fastestSupplier?.supplierName || '-'}
            </div>
            <p className="text-[var(--status-success)] text-sm font-semibold">
              {fastestSupplier?.avgLeadTime || 0} วัน
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[var(--status-error)]" />
              ช้าที่สุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-[var(--text-primary)] truncate">
              {slowestSupplier?.supplierName || '-'}
            </div>
            <p className="text-[var(--status-error)] text-sm font-semibold">
              {slowestSupplier?.avgLeadTime || 0} วัน
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-[var(--text-primary)]">กราฟ Lead Time ตาม Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-[var(--text-muted)]">
              ไม่มีข้อมูล Lead Time
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border-default)]" />
                <XAxis type="number" className="text-[var(--text-muted)]" unit=" วัน" />
                <YAxis dataKey="name" type="category" className="text-[var(--text-muted)]" width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, _name: any, props: any) => [
                    `${value ?? 0} วัน`,
                    props?.payload?.fullName ?? '',
                  ]}
                />
                <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-[var(--text-primary)]">รายละเอียด Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">
              ไม่มีข้อมูล
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)]">อันดับ</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Supplier</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">จำนวน PO</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">Lead Time เฉลี่ย</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">เร็วสุด</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">ช้าสุด</TableHead>
                  <TableHead className="text-[var(--text-muted)]">ประสิทธิภาพ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={item.supplierId} className="border-[var(--border-default)] hover:bg-[var(--bg-hover)]">
                    <TableCell className="font-medium text-[var(--text-primary)]">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: COLORS[index % COLORS.length] + '40', color: COLORS[index % COLORS.length] }}
                      >
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--text-primary)] font-medium">{item.supplierName}</TableCell>
                    <TableCell className="text-right text-[var(--text-secondary)]">
                      {item.poCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[var(--accent-primary)] font-semibold">
                      {item.avgLeadTime} วัน
                    </TableCell>
                    <TableCell className="text-right text-[var(--status-success)]">
                      {item.minLeadTime} วัน
                    </TableCell>
                    <TableCell className="text-right text-[var(--status-error)]">
                      {item.maxLeadTime} วัน
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPerformanceColor(item.avgLeadTime)}>
                        {getPerformanceLabel(item.avgLeadTime)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
