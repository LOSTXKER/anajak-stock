'use client'

import { useEffect, useState } from 'react'
import { PageHeader, PageLoading, EmptyState } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  getABCAnalysis,
  getStockTurnoverAnalysis,
  getMovementTrends,
  getCategoryPerformance,
  getSupplierPerformance,
  type ABCItem,
  type TurnoverItem,
  type MovementTrend,
  type CategoryPerformance,
  type SupplierPerformance,
} from '@/actions/analytics'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import { Button } from '@/components/ui/button'

const COLORS = [
  'var(--accent-primary)',
  'var(--status-success)',
  'var(--status-warning)',
  'var(--status-danger)',
  'var(--status-info)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('abc')
  const [abcData, setAbcData] = useState<ABCItem[]>([])
  const [turnoverData, setTurnoverData] = useState<TurnoverItem[]>([])
  const [trendsData, setTrendsData] = useState<MovementTrend[]>([])
  const [categoryData, setCategoryData] = useState<CategoryPerformance[]>([])
  const [supplierData, setSupplierData] = useState<SupplierPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const [abc, turnover, trends, category, supplier] = await Promise.all([
        getABCAnalysis(),
        getStockTurnoverAnalysis(),
        getMovementTrends(),
        getCategoryPerformance(),
        getSupplierPerformance(),
      ])

      if (abc.success && abc.data) setAbcData(abc.data)
      if (turnover.success && turnover.data) setTurnoverData(turnover.data)
      if (trends.success && trends.data) setTrendsData(trends.data)
      if (category.success && category.data) setCategoryData(category.data)
      if (supplier.success && supplier.data) setSupplierData(supplier.data)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <PageLoading message="กำลังโหลดข้อมูลวิเคราะห์..." />
  }

  // Prepare ABC summary
  const abcSummary = {
    A: abcData.filter((i) => i.classification === 'A'),
    B: abcData.filter((i) => i.classification === 'B'),
    C: abcData.filter((i) => i.classification === 'C'),
  }

  const abcChartData = [
    { name: 'A', count: abcSummary.A.length, value: abcSummary.A.reduce((s, i) => s + i.totalValue, 0), fill: 'var(--status-success)' },
    { name: 'B', count: abcSummary.B.length, value: abcSummary.B.reduce((s, i) => s + i.totalValue, 0), fill: 'var(--status-warning)' },
    { name: 'C', count: abcSummary.C.length, value: abcSummary.C.reduce((s, i) => s + i.totalValue, 0), fill: 'var(--status-danger)' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="วิเคราะห์เชิงลึก"
        description="ข้อมูลวิเคราะห์สต๊อคและประสิทธิภาพ"
        icon={<BarChart3 className="w-6 h-6 text-[var(--accent-primary)]" />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--bg-secondary)] border border-[var(--border-default)]">
          <TabsTrigger value="abc">ABC Analysis</TabsTrigger>
          <TabsTrigger value="turnover">Stock Turnover</TabsTrigger>
          <TabsTrigger value="trends">แนวโน้ม</TabsTrigger>
          <TabsTrigger value="category">หมวดหมู่</TabsTrigger>
          <TabsTrigger value="supplier">ซัพพลายเออร์</TabsTrigger>
        </TabsList>

        {/* ABC Analysis */}
        <TabsContent value="abc" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {abcChartData.map((item) => (
              <Card key={item.name} className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-muted)]">กลุ่ม {item.name}</p>
                      <p className="text-2xl font-bold">{item.count} รายการ</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        ฿{item.value.toLocaleString()}
                      </p>
                    </div>
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                      style={{ backgroundColor: item.fill }}
                    >
                      {item.name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg">Pareto Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={abcData.slice(0, 20)}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="var(--border-default)"
                      />
                      <XAxis 
                        dataKey="sku" 
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fill: 'var(--text-muted)' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: 'var(--text-muted)' }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="totalValue" 
                        fill="var(--accent-primary)"
                        name="มูลค่า"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cumulativePercentage"
                        stroke="var(--status-danger)"
                        name="สะสม %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg">สัดส่วนมูลค่า</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={abcChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {abcChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => typeof value === 'number' ? `฿${value.toLocaleString()}` : String(value)}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ABC Table */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg">รายละเอียดสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-left py-2 px-4">SKU</th>
                      <th className="text-left py-2 px-4">ชื่อสินค้า</th>
                      <th className="text-right py-2 px-4">มูลค่า</th>
                      <th className="text-right py-2 px-4">สัดส่วน</th>
                      <th className="text-center py-2 px-4">กลุ่ม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abcData.slice(0, 50).map((item) => (
                      <tr key={item.id} className="border-b border-[var(--border-subtle)]">
                        <td className="py-2 px-4 font-mono text-sm">{item.sku}</td>
                        <td className="py-2 px-4">{item.name}</td>
                        <td className="py-2 px-4 text-right">฿{item.totalValue.toLocaleString()}</td>
                        <td className="py-2 px-4 text-right">{item.percentage.toFixed(1)}%</td>
                        <td className="py-2 px-4 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium text-white ${
                              item.classification === 'A'
                                ? 'bg-[var(--status-success)]'
                                : item.classification === 'B'
                                ? 'bg-[var(--status-warning)]'
                                : 'bg-[var(--status-danger)]'
                            }`}
                          >
                            {item.classification}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Turnover */}
        <TabsContent value="turnover" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg">อัตราหมุนเวียนสต๊อค</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={turnoverData.slice(0, 15)} layout="vertical">
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="var(--border-default)"
                      />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'var(--text-muted)' }}
                      />
                      <YAxis 
                        type="category"
                        dataKey="sku"
                        width={80}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        dataKey="turnoverRate" 
                        fill="var(--accent-primary)"
                        name="หมุนเวียน/ปี"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg">Days of Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                      <tr className="border-b border-[var(--border-default)]">
                        <th className="text-left py-2">SKU</th>
                        <th className="text-right py-2">สต๊อค</th>
                        <th className="text-right py-2">เบิก (90 วัน)</th>
                        <th className="text-right py-2">Days Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnoverData.slice(0, 20).map((item) => (
                        <tr key={item.id} className="border-b border-[var(--border-subtle)]">
                          <td className="py-2 font-mono text-sm">{item.sku}</td>
                          <td className="py-2 text-right">{item.avgStock.toLocaleString()}</td>
                          <td className="py-2 text-right">{item.totalIssued.toLocaleString()}</td>
                          <td className="py-2 text-right">
                            <span
                              className={`font-medium ${
                                item.daysOfStock <= 7
                                  ? 'text-[var(--status-danger)]'
                                  : item.daysOfStock <= 30
                                  ? 'text-[var(--status-warning)]'
                                  : 'text-[var(--status-success)]'
                              }`}
                            >
                              {item.daysOfStock > 365 ? '365+' : item.daysOfStock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends" className="space-y-4">
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg">แนวโน้มการเคลื่อนไหว (30 วัน)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendsData}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="var(--border-default)"
                    />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                    />
                    <YAxis tick={{ fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="receive"
                      stackId="1"
                      stroke="var(--status-success)"
                      fill="var(--status-success)"
                      fillOpacity={0.6}
                      name="รับเข้า"
                    />
                    <Area
                      type="monotone"
                      dataKey="issue"
                      stackId="2"
                      stroke="var(--status-danger)"
                      fill="var(--status-danger)"
                      fillOpacity={0.6}
                      name="เบิกออก"
                    />
                    <Area
                      type="monotone"
                      dataKey="transfer"
                      stackId="3"
                      stroke="var(--accent-primary)"
                      fill="var(--accent-primary)"
                      fillOpacity={0.6}
                      name="โอนย้าย"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Performance */}
        <TabsContent value="category" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg">มูลค่าตามหมวดหมู่</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data={categoryData as any}
                        dataKey="totalValue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => typeof value === 'number' ? `฿${value.toLocaleString()}` : String(value)}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg">สรุปหมวดหมู่</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryData.map((cat, index) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {cat.productCount} สินค้า
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">฿{cat.totalValue.toLocaleString()}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {cat.totalMovements} movements
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Supplier Performance */}
        <TabsContent value="supplier" className="space-y-4">
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg">ประสิทธิภาพซัพพลายเออร์</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-left py-3 px-4">ซัพพลายเออร์</th>
                      <th className="text-right py-3 px-4">POs</th>
                      <th className="text-right py-3 px-4">มูลค่ารวม</th>
                      <th className="text-right py-3 px-4">Lead Time</th>
                      <th className="text-right py-3 px-4">On-Time %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierData.map((supplier) => (
                      <tr key={supplier.id} className="border-b border-[var(--border-subtle)]">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">{supplier.code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">{supplier.totalPOs}</td>
                        <td className="py-3 px-4 text-right">฿{supplier.totalValue.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">{supplier.avgLeadTime} วัน</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-medium ${
                              supplier.onTimeDeliveryRate >= 90
                                ? 'text-[var(--status-success)]'
                                : supplier.onTimeDeliveryRate >= 70
                                ? 'text-[var(--status-warning)]'
                                : 'text-[var(--status-danger)]'
                            }`}
                          >
                            {supplier.onTimeDeliveryRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
