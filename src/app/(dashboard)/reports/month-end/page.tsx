'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  CalendarDays,
  Download,
  Search,
  Warehouse,
  DollarSign,
  Layers,
  Package,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  ClipboardList,
  PieChartIcon,
} from 'lucide-react'
import {
  getMonthEndStock,
  getMonthlyStockTrend,
  exportMonthEndStockCSV,
  type MonthEndStockItem,
  type MonthEndSummary,
  type TrendDataPoint,
  type MovementSummaryByType,
} from '@/actions/month-end-stock'
import { PageHeader, StatCard, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

interface Category { id: string; name: string }
interface WarehouseItem { id: string; name: string; code: string }

export default function MonthEndStockPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [isLoading, setIsLoading] = useState(true)
  const [isTrendLoading, setIsTrendLoading] = useState(true)

  const [data, setData] = useState<MonthEndStockItem[]>([])
  const [summary, setSummary] = useState<MonthEndSummary>({ totalSKUs: 0, totalQty: 0, totalValue: 0 })
  const [prevSummary, setPrevSummary] = useState<MonthEndSummary | null>(null)
  const [movementSummary, setMovementSummary] = useState<MovementSummaryByType | null>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    warehouseId: '',
  })

  const debouncedSearch = useDebounce(filters.search, 300)

  const thaiYear = selectedYear + 543
  const periodLabel = `${THAI_MONTHS[selectedMonth - 1]} ${thaiYear}`

  const loadData = useCallback(async (year: number, month: number) => {
    setIsLoading(true)
    try {
      const result = await getMonthEndStock(year, month)
      if (result.success) {
        setData(result.data.items)
        setSummary(result.data.summary)
        setPrevSummary(result.data.prevSummary)
        setMovementSummary(result.data.movementSummary)
        setCategories(result.data.categories)
        setWarehouses(result.data.warehouses)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadTrend = useCallback(async () => {
    setIsTrendLoading(true)
    try {
      const result = await getMonthlyStockTrend(6)
      if (result.success) {
        setTrendData(result.data)
      }
    } catch {
      // trend chart is non-critical
    } finally {
      setIsTrendLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedYear, selectedMonth)
  }, [selectedYear, selectedMonth, loadData])

  useEffect(() => {
    loadTrend()
  }, [loadTrend])

  function navigateMonth(delta: number) {
    let m = selectedMonth + delta
    let y = selectedYear
    if (m > 12) { m = 1; y += 1 }
    if (m < 1) { m = 12; y -= 1 }
    setSelectedMonth(m)
    setSelectedYear(y)
  }

  function goToCurrentMonth() {
    setSelectedYear(now.getFullYear())
    setSelectedMonth(now.getMonth() + 1)
  }

  function goToPreviousMonth() {
    const pm = now.getMonth() // 0-indexed, so this is previous month (1-indexed)
    const py = pm === 0 ? now.getFullYear() - 1 : now.getFullYear()
    setSelectedMonth(pm === 0 ? 12 : pm)
    setSelectedYear(py)
  }

  async function handleExport() {
    try {
      const csv = await exportMonthEndStockCSV(selectedYear, selectedMonth, filters)
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stock-month-end-${selectedYear}${selectedMonth.toString().padStart(2, '0')}-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Export สำเร็จ')
    } catch {
      toast.error('Export ไม่สำเร็จ')
    }
  }

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase()
        if (!item.sku.toLowerCase().includes(s) && !item.name.toLowerCase().includes(s)) {
          return false
        }
      }
      if (filters.categoryId) {
        const cat = categories.find((c) => c.id === filters.categoryId)
        if (cat && item.category !== cat.name) return false
      }
      if (filters.warehouseId) {
        const wh = warehouses.find((w) => w.id === filters.warehouseId)
        if (wh && item.warehouseName !== wh.name) return false
      }
      return true
    })
  }, [data, debouncedSearch, filters.categoryId, filters.warehouseId, categories, warehouses])

  const filteredTotals = useMemo(() => ({
    totalSKUs: new Set(filteredData.map((d) => d.productId)).size,
    totalQty: filteredData.reduce((sum, d) => sum + d.qtyOnHand, 0),
    totalValue: filteredData.reduce((sum, d) => sum + d.stockValue, 0),
  }), [filteredData])

  const valueDelta = prevSummary
    ? summary.totalValue - prevSummary.totalValue
    : null
  const valueDeltaPct = prevSummary && prevSummary.totalValue > 0
    ? ((summary.totalValue - prevSummary.totalValue) / prevSummary.totalValue) * 100
    : null
  const qtyDelta = prevSummary
    ? summary.totalQty - prevSummary.totalQty
    : null

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; qty: number; value: number }>()
    for (const item of filteredData) {
      const key = item.category || 'ไม่ระบุหมวดหมู่'
      const existing = map.get(key) || { category: key, qty: 0, value: 0 }
      existing.qty += item.qtyOnHand
      existing.value += item.stockValue
      map.set(key, existing)
    }
    const arr = Array.from(map.values()).sort((a, b) => b.value - a.value)
    const total = arr.reduce((s, i) => s + i.value, 0)
    return arr.map((i) => ({ ...i, pct: total > 0 ? (i.value / total) * 100 : 0 }))
  }, [filteredData])

  const PIE_COLORS = [
    'var(--accent-primary)', 'var(--status-success)', 'var(--status-warning)',
    'var(--status-danger)', 'var(--status-info)', '#8b5cf6', '#ec4899', '#14b8a6',
  ]

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="สต็อคคงเหลือ ณ สิ้นเดือน"
          description="รายงานยอดคงเหลือสินค้าคงคลังสุทธิสำหรับปิดบัญชีประจำเดือน"
          icon={<CalendarDays className="w-6 h-6" />}
        />
        <Button onClick={handleExport} variant="outline" disabled={isLoading}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Month Picker */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigateMonth(-1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2">
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(v) => setSelectedMonth(Number(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THAI_MONTHS_SHORT.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(selectedYear)}
                  onValueChange={(v) => setSelectedYear(Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y + 543}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => navigateMonth(1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
                เดือนนี้
              </Button>
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                เดือนก่อน
              </Button>
            </div>

            {/* Period Display */}
            <div className="ml-auto flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <CalendarDays className="w-4 h-4" />
              <span>ข้อมูล ณ สิ้นเดือน</span>
              <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)] font-medium">
                {periodLabel}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="จำนวน SKU"
          value={summary.totalSKUs.toLocaleString()}
          subtitle="รายการที่มีสต็อค"
          icon={Layers}
          variant="info"
        />
        <StatCard
          title="จำนวนคงเหลือ"
          value={summary.totalQty.toLocaleString()}
          subtitle="ชิ้น"
          icon={Package}
          variant="success"
          trend={qtyDelta !== null ? {
            value: Math.abs(qtyDelta),
            isPositive: qtyDelta >= 0,
          } : undefined}
        />
        <StatCard
          title="มูลค่ารวม"
          value={`฿${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          subtitle="ต้นทุนสินค้าคงเหลือ"
          icon={DollarSign}
          variant="primary"
          trend={valueDeltaPct !== null ? {
            value: Math.abs(Math.round(valueDeltaPct * 10) / 10),
            isPositive: valueDeltaPct >= 0,
          } : undefined}
        />
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-muted)]">เปลี่ยนแปลงจากเดือนก่อน</span>
            {valueDelta !== null && (
              valueDelta >= 0
                ? <ArrowUpRight className="w-4 h-4 text-[var(--status-success)]" />
                : <ArrowDownRight className="w-4 h-4 text-[var(--status-danger)]" />
            )}
          </div>
          {valueDelta !== null ? (
            <>
              <p className={`text-xl font-bold ${valueDelta >= 0 ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`}>
                {valueDelta >= 0 ? '+' : ''}{`฿${valueDelta.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              </p>
              {valueDeltaPct !== null && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {valueDeltaPct >= 0 ? '+' : ''}{valueDeltaPct.toFixed(1)}% จากเดือนก่อน
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">ไม่มีข้อมูลเดือนก่อน</p>
          )}
        </Card>
      </div>

      {/* Inventory Reconciliation */}
      {!isLoading && movementSummary && prevSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[var(--accent-primary)]" />
              สรุปความเคลื่อนไหวสต็อค ประจำเดือน {THAI_MONTHS_SHORT[selectedMonth - 1]} {thaiYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">รายการ</TableHead>
                  <TableHead className="text-right">จำนวน (ชิ้น)</TableHead>
                  <TableHead className="text-right">มูลค่า (บาท)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-[var(--bg-hover)]">
                  <TableCell className="font-semibold">ยอดต้นงวด</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{prevSummary.totalQty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">฿{prevSummary.totalValue.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[var(--status-success)]">+ รับเข้า (RECEIVE)</TableCell>
                  <TableCell className="text-right font-mono text-[var(--status-success)]">+{movementSummary.receive.qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[var(--status-success)]">+฿{movementSummary.receive.value.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[var(--status-success)]">+ รับคืน (RETURN)</TableCell>
                  <TableCell className="text-right font-mono text-[var(--status-success)]">+{movementSummary.return.qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[var(--status-success)]">+฿{movementSummary.return.value.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[var(--status-danger)]">- เบิกออก (ISSUE)</TableCell>
                  <TableCell className="text-right font-mono text-[var(--status-danger)]">-{movementSummary.issue.qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[var(--status-danger)]">-฿{movementSummary.issue.value.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      โอนเข้า (TRANSFER IN)
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[var(--text-muted)]">{movementSummary.transferIn.qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[var(--text-muted)]">฿{movementSummary.transferIn.value.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      โอนออก (TRANSFER OUT)
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[var(--text-muted)]">{movementSummary.transferOut.qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[var(--text-muted)]">฿{movementSummary.transferOut.value.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={movementSummary.adjust.qty >= 0 ? 'text-[var(--status-info)]' : 'text-[var(--status-warning)]'}>
                    ± ปรับปรุง (ADJUST)
                  </TableCell>
                  <TableCell className={`text-right font-mono ${movementSummary.adjust.qty >= 0 ? 'text-[var(--status-info)]' : 'text-[var(--status-warning)]'}`}>
                    {movementSummary.adjust.qty >= 0 ? '+' : ''}{movementSummary.adjust.qty.toLocaleString()}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${movementSummary.adjust.value >= 0 ? 'text-[var(--status-info)]' : 'text-[var(--status-warning)]'}`}>
                    {movementSummary.adjust.value >= 0 ? '+' : ''}฿{movementSummary.adjust.value.toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-[var(--bg-hover)] border-t-2 border-[var(--border-default)]">
                  <TableCell className="font-bold text-base">= ยอดปลายงวด</TableCell>
                  <TableCell className="text-right font-mono font-bold text-base">{summary.totalQty.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-base">฿{summary.totalValue.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      {!isLoading && categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[var(--accent-primary)]" />
              สรุปมูลค่าตามหมวดหมู่
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {categoryBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [`฿${Number(value).toLocaleString()}`, 'มูลค่า']}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead className="text-right">มูลค่า</TableHead>
                      <TableHead className="text-right">สัดส่วน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryBreakdown.map((cat, idx) => (
                      <TableRow key={cat.category}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                            />
                            {cat.category}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{cat.qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">฿{cat.value.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-[var(--text-muted)]">{cat.pct.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
            แนวโน้มมูลค่าสต็อค 6 เดือนย้อนหลัง
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isTrendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-sm text-[var(--text-muted)]">กำลังโหลดกราฟ...</div>
            </div>
          ) : trendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`฿${Number(value).toLocaleString()}`, 'มูลค่าสต็อค']}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalValue"
                    stroke="var(--accent-primary)"
                    fill="var(--accent-primary)"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name="มูลค่าสต็อค"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[var(--text-muted)]">
              ไม่มีข้อมูลสำหรับแสดงกราฟ
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label className="text-xs text-[var(--text-muted)]">ค้นหา</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  placeholder="SKU หรือชื่อสินค้า..."
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[var(--text-muted)]">หมวดหมู่</Label>
              <Select
                value={filters.categoryId}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, categoryId: v === '__all__' ? '' : v }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทั้งหมด</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[var(--text-muted)]">คลังสินค้า</Label>
              <Select
                value={filters.warehouseId}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, warehouseId: v === '__all__' ? '' : v }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทั้งหมด</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      <div className="flex items-center gap-2">
                        <Warehouse className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        {wh.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสต็อคคงเหลือ ณ สิ้นเดือน {THAI_MONTHS_SHORT[selectedMonth - 1]} {thaiYear}
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {filteredData.length} รายการ
            </Badge>
            {(filters.search || filters.categoryId || filters.warehouseId) && (
              <span className="text-xs text-[var(--text-muted)] font-normal">
                (กรองแล้ว — มูลค่ารวม ฿{filteredTotals.totalValue.toLocaleString()})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <PageSkeleton hasStats={false} />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Package className="w-8 h-8" />}
                title="ไม่พบข้อมูล"
                description={
                  filters.search || filters.categoryId || filters.warehouseId
                    ? 'ลองปรับตัวกรองใหม่'
                    : `ไม่มีข้อมูลสต็อคในเดือน ${periodLabel}`
                }
              />
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-[var(--bg-elevated)]">
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>ตัวเลือก</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead>คลัง</TableHead>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead className="text-right">คงเหลือ</TableHead>
                    <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                    <TableHead className="text-right">มูลค่า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, idx) => (
                    <TableRow key={`${item.productId}-${item.locationCode}-${idx}`}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/products/${item.productId}`}
                          className="text-[var(--accent-primary)] hover:underline"
                        >
                          {item.sku}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {item.variantName || '-'}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {item.category || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {item.warehouseName}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-muted)]">
                        {item.locationCode}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <span className={item.qtyOnHand < 0 ? 'text-[var(--status-danger)]' : item.qtyOnHand === 0 ? 'text-[var(--status-error)]' : ''}>
                          {item.qtyOnHand.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--text-muted)]">
                        ฿{item.unitCost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ฿{item.stockValue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="bg-[var(--bg-hover)] font-semibold border-t-2">
                    <TableCell colSpan={6} className="text-right">
                      รวมทั้งหมด
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {filteredTotals.totalQty.toLocaleString()}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono">
                      ฿{filteredTotals.totalValue.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
