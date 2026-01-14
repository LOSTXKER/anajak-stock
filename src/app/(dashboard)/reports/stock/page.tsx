'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Package, Download, Search, Warehouse, DollarSign, Layers } from 'lucide-react'
import { getStockReport, exportStockReportToCSV } from '@/actions/stock-report'
import { PageHeader, StatCard, EmptyState } from '@/components/common'
import { PageSkeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface StockReportItem {
  productId: string
  sku: string
  name: string
  category: string | null
  variantName: string | null
  locationCode: string
  warehouseName: string
  qtyOnHand: number
  qtyReserved: number
  qtyAvailable: number
  unitCost: number
  stockValue: number
}

interface Category {
  id: string
  name: string
}

interface Warehouse {
  id: string
  name: string
  code: string
}

export default function StockReportPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<StockReportItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    warehouseId: '',
    showZero: false,
  })

  // Debounce search to avoid filtering on every keystroke
  const debouncedSearch = useDebounce(filters.search, 300)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getStockReport()
      if (result.success) {
        setData(result.data.items)
        setCategories(result.data.categories)
        setWarehouses(result.data.warehouses)
      }
    } catch (error) {
      console.error('Error loading stock report:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleExport() {
    try {
      const csv = await exportStockReportToCSV(filters)
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stock-report-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Export สำเร็จ')
    } catch {
      toast.error('Export ไม่สำเร็จ')
    }
  }

  // Filter data with useMemo for performance
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Use debounced search
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase()
        if (
          !item.sku.toLowerCase().includes(search) &&
          !item.name.toLowerCase().includes(search)
        ) {
          return false
        }
      }
      if (filters.categoryId) {
        const cat = categories.find(c => c.id === filters.categoryId)
        if (cat && item.category !== cat.name) return false
      }
      if (filters.warehouseId) {
        const wh = warehouses.find(w => w.id === filters.warehouseId)
        if (wh && item.warehouseName !== wh.name) return false
      }
      if (!filters.showZero && item.qtyOnHand === 0) {
        return false
      }
      return true
    })
  }, [data, debouncedSearch, filters.categoryId, filters.warehouseId, filters.showZero, categories, warehouses])

  // Calculate totals with useMemo
  const { totalSKUs, totalQty, totalValue } = useMemo(() => ({
    totalSKUs: new Set(filteredData.map(d => d.productId)).size,
    totalQty: filteredData.reduce((sum, d) => sum + d.qtyOnHand, 0),
    totalValue: filteredData.reduce((sum, d) => sum + d.stockValue, 0),
  }), [filteredData])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="รายงานสต๊อคสินค้า"
          description="ยอดคงเหลือสินค้าตามคลังและตำแหน่ง"
          icon={<Package className="w-6 h-6" />}
        />
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="จำนวน SKU"
          value={totalSKUs.toLocaleString()}
          subtitle="รายการสินค้า"
          icon={Layers}
          variant="info"
        />
        <StatCard
          title="จำนวนคงเหลือ"
          value={totalQty.toLocaleString()}
          subtitle="ชิ้น"
          icon={Package}
          variant="success"
        />
        <StatCard
          title="มูลค่ารวม"
          value={`฿${totalValue.toLocaleString()}`}
          subtitle="ต้นทุนรวม"
          icon={DollarSign}
          variant="primary"
        />
      </div>

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
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[var(--text-muted)]">หมวดหมู่</Label>
              <Select
                value={filters.categoryId}
                onValueChange={(v) => setFilters(prev => ({ ...prev, categoryId: v === '__all__' ? '' : v }))}
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
                onValueChange={(v) => setFilters(prev => ({ ...prev, warehouseId: v === '__all__' ? '' : v }))}
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showZero"
                checked={filters.showZero}
                onChange={(e) => setFilters(prev => ({ ...prev, showZero: e.target.checked }))}
                className="rounded border-[var(--border-default)]"
              />
              <Label htmlFor="showZero" className="text-sm cursor-pointer">แสดงสต๊อค 0</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสต๊อค
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {filteredData.length} รายการ
            </Badge>
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
                description={filters.search || filters.categoryId || filters.warehouseId
                  ? 'ลองปรับตัวกรองใหม่'
                  : 'ยังไม่มีสต๊อคสินค้า'
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
                    <TableHead className="text-right">จอง</TableHead>
                    <TableHead className="text-right">พร้อมใช้</TableHead>
                    <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                    <TableHead className="text-right">มูลค่า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, idx) => (
                    <TableRow key={`${item.productId}-${item.locationCode}-${idx}`}>
                      <TableCell className="font-mono text-sm">
                        <Link href={`/products/${item.productId}`} className="text-[var(--accent-primary)] hover:underline">
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
                        <span className={item.qtyOnHand === 0 ? 'text-[var(--status-error)]' : ''}>
                          {item.qtyOnHand.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--text-muted)]">
                        {item.qtyReserved.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-[var(--status-success)]">
                        {item.qtyAvailable.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--text-muted)]">
                        ฿{item.unitCost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ฿{item.stockValue.toLocaleString()}
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
