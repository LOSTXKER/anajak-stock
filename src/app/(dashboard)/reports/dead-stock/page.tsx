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
import { TrendingDown, Download, AlertTriangle, Package, DollarSign } from 'lucide-react'
import { getDeadStock } from '@/actions/reports'

interface DeadStockItem {
  productId: string
  sku: string
  name: string
  category: string | null
  totalStock: number
  stockValue: number
  lastMovementDate: Date
  daysSinceMove: number
}

export default function DeadStockPage() {
  const [period, setPeriod] = useState<'30' | '60' | '90' | '180'>('60')
  const [data, setData] = useState<DeadStockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getDeadStock(Number(period), 100)
        if (result.success) {
          setData(result.data.map(item => ({
            ...item,
            lastMovementDate: new Date(item.lastMovementDate),
          })))
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [period])

  const totalItems = data.length
  const totalStock = data.reduce((sum, item) => sum + item.totalStock, 0)
  const totalValue = data.reduce((sum, item) => sum + item.stockValue, 0)

  const getSeverityColor = (days: number) => {
    if (days > 180) return 'bg-[var(--status-error-light)] text-[var(--status-error)] border-[var(--status-error)]/30'
    if (days > 90) return 'bg-[var(--status-warning-light)] text-[var(--status-warning)] border-[var(--status-warning)]/30'
    return 'bg-[var(--status-info-light)] text-[var(--status-info)] border-[var(--status-info)]/30'
  }

  const getSeverityLabel = (days: number) => {
    if (days > 180) return 'วิกฤต'
    if (days > 90) return 'เตือน'
    return 'ติดตาม'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-[var(--status-error)]" />
            Dead Stock Report
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            สินค้าที่ไม่มีการเคลื่อนไหวเกินกว่าที่กำหนด
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
              <AlertTriangle className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)] text-sm">ไม่มีการเคลื่อนไหวเกิน:</span>
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-40 bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectItem value="30" className="text-[var(--text-secondary)]">30 วัน</SelectItem>
                  <SelectItem value="60" className="text-[var(--text-secondary)]">60 วัน</SelectItem>
                  <SelectItem value="90" className="text-[var(--text-secondary)]">90 วัน</SelectItem>
                  <SelectItem value="180" className="text-[var(--text-secondary)]">180 วัน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--status-error)]" />
              จำนวน SKU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{totalItems.toLocaleString()}</div>
            <p className="text-[var(--text-muted)] text-sm">รายการที่ไม่มีการเคลื่อนไหว</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--status-warning)]" />
              จำนวนสต๊อค
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{totalStock.toLocaleString()}</div>
            <p className="text-[var(--text-muted)] text-sm">ชิ้นที่จมอยู่</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--accent-primary)]" />
              มูลค่ารวม
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--text-primary)]">
              {totalValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
            </div>
            <p className="text-[var(--text-muted)] text-sm">ทุนจม</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-[var(--text-primary)]">รายการสินค้า Dead Stock</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">
              <div className="text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-[var(--status-success)]" />
                <p>ไม่พบสินค้าที่ไม่มีการเคลื่อนไหว</p>
                <p className="text-sm mt-1">สต๊อคทุกรายการมีการเคลื่อนไหวปกติ</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                  <TableHead className="text-[var(--text-muted)]">ชื่อสินค้า</TableHead>
                  <TableHead className="text-[var(--text-muted)]">หมวดหมู่</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">จำนวนคงเหลือ</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">มูลค่า</TableHead>
                  <TableHead className="text-[var(--text-muted)]">วันที่เคลื่อนไหวล่าสุด</TableHead>
                  <TableHead className="text-[var(--text-muted)] text-right">จำนวนวัน</TableHead>
                  <TableHead className="text-[var(--text-muted)]">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.productId} className="border-[var(--border-default)] hover:bg-[var(--bg-hover)]">
                    <TableCell className="text-[var(--text-secondary)] font-mono">{item.sku}</TableCell>
                    <TableCell className="text-[var(--text-primary)]">{item.name}</TableCell>
                    <TableCell className="text-[var(--text-muted)]">{item.category || '-'}</TableCell>
                    <TableCell className="text-right text-[var(--text-secondary)]">
                      {item.totalStock.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[var(--status-warning)] font-semibold">
                      {item.stockValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {item.lastMovementDate.toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell className="text-right text-[var(--status-error)] font-semibold">
                      {item.daysSinceMove} วัน
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSeverityColor(item.daysSinceMove)}>
                        {getSeverityLabel(item.daysSinceMove)}
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
