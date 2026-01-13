'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Calendar,
  Package,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react'
import { getProductForecast, getCategories } from '@/actions/forecast'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface ForecastItem {
  productId: string
  sku: string
  name: string
  category: string | null
  currentStock: number
  reorderPoint: number
  monthlyUsage: number[]
  avgMonthlyUsage: number
  forecastNextMonth: number
  daysOfSupply: number
  suggestedOrder: number
  trend: 'up' | 'down' | 'stable'
}

interface Category {
  id: string
  name: string
}

export default function ForecastPage() {
  const [months, setMonths] = useState<'3' | '6' | '12'>('6')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [categories, setCategories] = useState<Category[]>([])
  const [data, setData] = useState<ForecastItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<ForecastItem | null>(null)

  useEffect(() => {
    async function loadCategories() {
      const result = await getCategories()
      if (result.success) {
        setCategories(result.data)
      }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getProductForecast(
          Number(months),
          categoryId !== 'all' ? categoryId : undefined
        )
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
  }, [months, categoryId])

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-[var(--status-success)]" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-[var(--status-error)]" />
      default:
        return <Minus className="w-4 h-4 text-[var(--text-muted)]" />
    }
  }

  const getDaysOfSupplyColor = (days: number) => {
    if (days <= 7) return 'text-[var(--status-error)]'
    if (days <= 14) return 'text-[var(--status-warning)]'
    if (days <= 30) return 'text-[var(--status-info)]'
    return 'text-[var(--status-success)]'
  }

  const getDaysOfSupplyBadge = (days: number) => {
    if (days <= 7) return <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)] border-[var(--status-error)]/30">วิกฤต</Badge>
    if (days <= 14) return <Badge className="bg-[var(--status-warning-light)] text-[var(--status-warning)] border-[var(--status-warning)]/30">เตือน</Badge>
    if (days <= 30) return <Badge className="bg-[var(--status-info-light)] text-[var(--status-info)] border-[var(--status-info)]/30">ติดตาม</Badge>
    return <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)] border-[var(--status-success)]/30">ปกติ</Badge>
  }

  // Generate month labels for chart
  const getMonthLabels = () => {
    const labels: string[] = []
    const date = new Date()
    date.setMonth(date.getMonth() - Number(months) + 1)
    for (let i = 0; i < Number(months); i++) {
      labels.push(date.toLocaleDateString('th-TH', { month: 'short' }))
      date.setMonth(date.getMonth() + 1)
    }
    return labels
  }

  const chartData = selectedProduct
    ? getMonthLabels().map((month, index) => ({
        month,
        usage: selectedProduct.monthlyUsage[index] || 0,
      }))
    : []

  const urgentCount = data.filter(d => d.daysOfSupply <= 14).length
  const totalSuggestedOrder = data.reduce((sum, d) => sum + d.suggestedOrder, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[var(--accent-primary)]" />
            พยากรณ์การใช้สินค้า
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            วิเคราะห์แนวโน้มและคาดการณ์ความต้องการสินค้า
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
              <span className="text-[var(--text-muted)] text-sm">ข้อมูลย้อนหลัง:</span>
              <Select value={months} onValueChange={(v) => setMonths(v as typeof months)}>
                <SelectTrigger className="w-32 bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectItem value="3" className="text-[var(--text-secondary)]">3 เดือน</SelectItem>
                  <SelectItem value="6" className="text-[var(--text-secondary)]">6 เดือน</SelectItem>
                  <SelectItem value="12" className="text-[var(--text-secondary)]">12 เดือน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)] text-sm">หมวดหมู่:</span>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-40 bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectItem value="all" className="text-[var(--text-secondary)]">ทั้งหมด</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-[var(--text-secondary)]">
                      {cat.name}
                    </SelectItem>
                  ))}
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
              <Package className="w-4 h-4 text-[var(--accent-primary)]" />
              สินค้าทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{data.length}</div>
            <p className="text-[var(--text-muted)] text-sm">รายการที่วิเคราะห์</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--status-error)]" />
              ต้องสั่งด่วน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--status-error)]">{urgentCount}</div>
            <p className="text-[var(--text-muted)] text-sm">สินค้าที่ Stock ต่ำกว่า 14 วัน</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--status-success)]" />
              แนวโน้มขาขึ้น
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--status-success)]">
              {data.filter(d => d.trend === 'up').length}
            </div>
            <p className="text-[var(--text-muted)] text-sm">สินค้าที่ใช้มากขึ้น</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[var(--accent-primary)]" />
              แนะนำสั่งซื้อ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--accent-primary)]">
              {totalSuggestedOrder.toLocaleString()}
            </div>
            <p className="text-[var(--text-muted)] text-sm">ชิ้นรวม</p>
          </CardContent>
        </Card>
      </div>

      {/* Selected Product Chart */}
      {selectedProduct && (
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader>
            <CardTitle className="text-[var(--text-primary)] flex items-center justify-between">
              <span>กราฟการใช้: {selectedProduct.sku} - {selectedProduct.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProduct(null)}
                className="text-[var(--text-muted)]"
              >
                ปิด
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border-default)]" />
                <XAxis dataKey="month" className="text-[var(--text-muted)]" />
                <YAxis className="text-[var(--text-muted)]" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString()} ชิ้น`, 'การใช้']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="usage"
                  name="การใช้"
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent-primary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{selectedProduct.avgMonthlyUsage.toLocaleString()}</div>
                <div className="text-sm text-[var(--text-muted)]">เฉลี่ย/เดือน</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--accent-primary)]">{selectedProduct.forecastNextMonth.toLocaleString()}</div>
                <div className="text-sm text-[var(--text-muted)]">พยากรณ์เดือนหน้า</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getDaysOfSupplyColor(selectedProduct.daysOfSupply)}`}>
                  {selectedProduct.daysOfSupply > 999 ? '999+' : selectedProduct.daysOfSupply}
                </div>
                <div className="text-sm text-[var(--text-muted)]">วัน Supply</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--accent-primary)]">{selectedProduct.suggestedOrder.toLocaleString()}</div>
                <div className="text-sm text-[var(--text-muted)]">แนะนำสั่ง</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-[var(--text-primary)]">รายละเอียดการพยากรณ์</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">
              ไม่มีข้อมูล
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                    <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                    <TableHead className="text-[var(--text-muted)]">ชื่อสินค้า</TableHead>
                    <TableHead className="text-[var(--text-muted)] text-right">Stock ปัจจุบัน</TableHead>
                    <TableHead className="text-[var(--text-muted)] text-right">เฉลี่ย/เดือน</TableHead>
                    <TableHead className="text-[var(--text-muted)] text-right">พยากรณ์</TableHead>
                    <TableHead className="text-[var(--text-muted)] text-right">Days of Supply</TableHead>
                    <TableHead className="text-[var(--text-muted)]">แนวโน้ม</TableHead>
                    <TableHead className="text-[var(--text-muted)] text-right">แนะนำสั่ง</TableHead>
                    <TableHead className="text-[var(--text-muted)]">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow
                      key={item.productId}
                      className="border-[var(--border-default)] hover:bg-[var(--bg-hover)] cursor-pointer"
                      onClick={() => setSelectedProduct(item)}
                    >
                      <TableCell className="font-mono text-[var(--accent-primary)]">{item.sku}</TableCell>
                      <TableCell className="text-[var(--text-primary)] max-w-[200px] truncate">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-secondary)]">
                        {item.currentStock.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-secondary)]">
                        {item.avgMonthlyUsage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-[var(--accent-primary)] font-semibold">
                        {item.forecastNextMonth.toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${getDaysOfSupplyColor(item.daysOfSupply)}`}>
                        {item.daysOfSupply > 999 ? '999+' : item.daysOfSupply} วัน
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(item.trend)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-[var(--accent-primary)] font-semibold">
                        {item.suggestedOrder > 0 ? item.suggestedOrder.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>
                        {getDaysOfSupplyBadge(item.daysOfSupply)}
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
