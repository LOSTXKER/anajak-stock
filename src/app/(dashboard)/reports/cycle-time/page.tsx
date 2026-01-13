'use client'

import { useState, useEffect } from 'react'
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
import { Clock, Download, Calendar, ArrowRight, FileText, ShoppingCart } from 'lucide-react'
import { getPRtoPOCycleTime } from '@/actions/reports'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface CycleTimeData {
  totalPRs: number
  convertedPRs: number
  avgCycleTime: number
  minCycleTime: number
  maxCycleTime: number
  distribution: {
    sameDay: number
    oneDay: number
    twoToThreeDays: number
    fourToSevenDays: number
    moreThanWeek: number
  }
  details: {
    prId: string
    prCode: string
    prDate: Date
    poDate: Date | null
    cycleTime: number | null
  }[]
}

const DISTRIBUTION_COLORS = ['#10b981', '#14b8a6', '#0ea5e9', '#f59e0b', '#ef4444']

export default function CycleTimePage() {
  const [period, setPeriod] = useState<'30' | '90' | '180' | '365'>('90')
  const [data, setData] = useState<CycleTimeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getPRtoPOCycleTime(Number(period))
        if (result.success) {
          setData({
            ...result.data,
            details: result.data.details.map(d => ({
              ...d,
              prDate: new Date(d.prDate),
              poDate: d.poDate ? new Date(d.poDate) : null,
            })),
          })
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [period])

  const pieChartData = data ? [
    { name: 'วันเดียวกัน', value: data.distribution.sameDay },
    { name: '1 วัน', value: data.distribution.oneDay },
    { name: '2-3 วัน', value: data.distribution.twoToThreeDays },
    { name: '4-7 วัน', value: data.distribution.fourToSevenDays },
    { name: '7+ วัน', value: data.distribution.moreThanWeek },
  ].filter(item => item.value > 0) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[var(--accent-primary)]" />
            รอบเวลา PR → PO
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            ระยะเวลาตั้งแต่ขอซื้อ (PR) จนถึงออกใบสั่งซื้อ (PO)
          </p>
        </div>
        <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)] text-sm">ช่วงเวลา:</span>
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-40 bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectItem value="30" className="text-[var(--text-secondary)]">30 วัน</SelectItem>
                  <SelectItem value="90" className="text-[var(--text-secondary)]">90 วัน</SelectItem>
                  <SelectItem value="180" className="text-[var(--text-secondary)]">180 วัน</SelectItem>
                  <SelectItem value="365" className="text-[var(--text-secondary)]">1 ปี</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
              PR ทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{data?.totalPRs || 0}</div>
            <p className="text-[var(--text-muted)] text-sm">ใบขอซื้อ</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[var(--status-success)]" />
              แปลงเป็น PO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{data?.convertedPRs || 0}</div>
            <p className="text-[var(--text-muted)] text-sm">
              {data && data.totalPRs > 0 
                ? `${((data.convertedPRs / data.totalPRs) * 100).toFixed(0)}% ของทั้งหมด`
                : '0%'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--status-info)]" />
              Cycle Time เฉลี่ย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{data?.avgCycleTime || 0} วัน</div>
            <p className="text-[var(--text-muted)] text-sm">PR → PO</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[var(--status-warning)]" />
              ช่วงเวลา
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-[var(--text-primary)]">
              {data?.minCycleTime || 0} - {data?.maxCycleTime || 0} วัน
            </div>
            <p className="text-[var(--text-muted)] text-sm">เร็วสุด - ช้าสุด</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-[var(--text-primary)]">การกระจายตัวของ Cycle Time</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
              </div>
            ) : pieChartData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-[var(--text-muted)]">
                ไม่มีข้อมูล
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => 
                      percent && percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''
                    }
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={(value: number | undefined) => [`${value ?? 0} รายการ`, 'จำนวน']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-[var(--text-primary)]">สรุปตามช่วงเวลา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'วันเดียวกัน', value: data?.distribution.sameDay || 0, color: '#10b981' },
                { label: '1 วัน', value: data?.distribution.oneDay || 0, color: '#14b8a6' },
                { label: '2-3 วัน', value: data?.distribution.twoToThreeDays || 0, color: '#0ea5e9' },
                { label: '4-7 วัน', value: data?.distribution.fourToSevenDays || 0, color: '#f59e0b' },
                { label: 'มากกว่า 7 วัน', value: data?.distribution.moreThanWeek || 0, color: '#ef4444' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24 text-[var(--text-muted)] text-sm">{item.label}</div>
                  <div className="flex-1 bg-[var(--bg-elevated)] rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${data && data.convertedPRs > 0 ? (item.value / data.convertedPRs) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-[var(--text-primary)] font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-[var(--text-primary)]">รายละเอียด PR ที่แปลงเป็น PO</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : !data || data.details.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">
              ไม่มีข้อมูล
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                    <TableHead className="text-[var(--text-muted)]">รหัส PR</TableHead>
                    <TableHead className="text-[var(--text-muted)]">วันที่ PR</TableHead>
                    <TableHead className="text-[var(--text-muted)]">วันที่ PO</TableHead>
                    <TableHead className="text-[var(--text-muted)] text-right">Cycle Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.details.slice(0, 20).map((item) => (
                    <TableRow key={item.prId} className="border-[var(--border-default)] hover:bg-[var(--bg-hover)]">
                      <TableCell className="text-[var(--text-primary)] font-mono">{item.prCode}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {item.prDate.toLocaleDateString('th-TH')}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {item.poDate?.toLocaleDateString('th-TH') || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${
                          (item.cycleTime || 0) <= 1 ? 'text-[var(--status-success)]' :
                          (item.cycleTime || 0) <= 3 ? 'text-[var(--status-info)]' :
                          (item.cycleTime || 0) <= 7 ? 'text-[var(--status-warning)]' : 'text-[var(--status-error)]'
                        }`}>
                          {item.cycleTime !== null ? `${item.cycleTime} วัน` : '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
