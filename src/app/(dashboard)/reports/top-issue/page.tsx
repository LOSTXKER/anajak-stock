'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TrendingUp, Download, Calendar, Package, Hash, PieChart } from 'lucide-react'
import { getTopIssueProducts } from '@/actions/reports'
import { PageHeader, StatCard, EmptyState } from '@/components/common'
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

interface TopIssueItem {
  productId: string
  sku: string
  name: string
  category: string | null
  totalQty: number
  issueCount: number
}

const COLORS = [
  '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
  '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444',
]

export default function TopIssuePage() {
  const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('30')
  const [limit, setLimit] = useState<'10' | '20' | '50'>('10')
  const [data, setData] = useState<TopIssueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getTopIssueProducts(Number(period), Number(limit))
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
  }, [period, limit])

  const chartData = data.map((item, index) => ({
    name: item.sku.length > 10 ? item.sku.substring(0, 10) + '...' : item.sku,
    fullName: item.name,
    qty: item.totalQty,
    color: COLORS[index % COLORS.length],
  }))

  const totalIssued = data.reduce((sum, item) => sum + item.totalQty, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Top สินค้าเบิกออก"
          description="สินค้าที่มีการเบิกออกมากที่สุดในช่วงเวลาที่เลือก"
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-muted)]">ช่วงเวลา:</span>
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 วัน</SelectItem>
                  <SelectItem value="30">30 วัน</SelectItem>
                  <SelectItem value="90">90 วัน</SelectItem>
                  <SelectItem value="365">1 ปี</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">แสดง:</span>
              <Select value={limit} onValueChange={(v) => setLimit(v as typeof limit)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="รวมเบิกออก"
          value={totalIssued.toLocaleString()}
          subtitle={`ชิ้น ใน ${period} วัน`}
          icon={Package}
          variant="success"
        />
        <StatCard
          title="จำนวน SKU"
          value={data.length}
          subtitle="รายการที่มีการเบิก"
          icon={Hash}
          variant="info"
        />
        <StatCard
          title="เฉลี่ยต่อ SKU"
          value={data.length > 0 ? Math.round(totalIssued / data.length).toLocaleString() : 0}
          subtitle="ชิ้น / SKU"
          icon={PieChart}
          variant="primary"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">กราฟแสดงจำนวนเบิกออก</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-80">
              <EmptyState
                icon={<TrendingUp className="w-8 h-8" />}
                title="ไม่มีข้อมูล"
                description="ไม่มีข้อมูลในช่วงเวลาที่เลือก"
              />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border-default)]" />
                <XAxis type="number" className="text-[var(--text-muted)]" />
                <YAxis dataKey="name" type="category" className="text-[var(--text-muted)]" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { fullName: string } }) => [
                    `${(value ?? 0).toLocaleString()} ชิ้น`,
                    props.payload?.fullName ?? '',
                  ]}
                />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียด</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>อันดับ</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">จำนวนเบิก (ชิ้น)</TableHead>
                  <TableHead className="text-right">จำนวนครั้ง</TableHead>
                  <TableHead className="text-right">% ของทั้งหมด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: COLORS[index % COLORS.length] + '30', color: COLORS[index % COLORS.length] }}
                      >
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link href={`/products/${item.productId}`} className="text-[var(--accent-primary)] hover:underline">
                        {item.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-[var(--text-muted)]">{item.category || '-'}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-[var(--status-success)]">
                      {item.totalQty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.issueCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[var(--text-muted)]">
                      {totalIssued > 0 ? ((item.totalQty / totalIssued) * 100).toFixed(1) : 0}%
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
