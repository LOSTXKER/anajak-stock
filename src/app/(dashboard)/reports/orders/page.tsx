'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { FileText, Download, Calendar, Package, Hash, Layers, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { getOrderSummaryReport, type OrderSummaryItem } from '@/actions/reports'
import { PageHeader, StatCard, EmptyState } from '@/components/common'
import { formatDateTime } from '@/lib/date'

export default function OrderSummaryPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState<{
    totalOrders: number
    totalItems: number
    totalQty: number
    orders: OrderSummaryItem[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getOrderSummaryReport({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      })
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleFilter = () => {
    loadData()
  }

  const handleClearFilter = () => {
    setDateFrom('')
    setDateTo('')
    setSearch('')
    // Load data without filters
    setTimeout(() => {
      getOrderSummaryReport({}).then(result => {
        if (result.success) {
          setData(result.data)
        }
      })
    }, 0)
  }

  const toggleOrder = (orderRef: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderRef)) {
        next.delete(orderRef)
      } else {
        next.add(orderRef)
      }
      return next
    })
  }

  const expandAll = () => {
    if (data) {
      setExpandedOrders(new Set(data.orders.map(o => o.orderRef)))
    }
  }

  const collapseAll = () => {
    setExpandedOrders(new Set())
  }

  const hasFilters = dateFrom || dateTo || search

  // Export to CSV
  const exportToCSV = () => {
    if (!data || data.orders.length === 0) return

    const rows: string[][] = [
      ['เลขออเดอร์', 'วันที่เบิก', 'เลขเอกสาร', 'SKU', 'สินค้า', 'Variant', 'จำนวน']
    ]

    for (const order of data.orders) {
      for (const item of order.items) {
        rows.push([
          order.orderRef,
          formatDateTime(item.issuedAt, { year: 'numeric', month: '2-digit', day: '2-digit' }),
          item.movementDocNumber,
          item.sku,
          item.productName,
          item.variantName || '-',
          item.qty.toString(),
        ])
      }
    }

    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `order-summary-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="รายงานสรุปออเดอร์"
          description="สรุปสินค้าที่เบิกแยกตามเลขออเดอร์จาก ERP"
          icon={<FileText className="w-6 h-6" />}
        />
        <Button variant="outline" onClick={exportToCSV} disabled={!data || data.orders.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-muted)]">จากวันที่</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-8 w-[150px] text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-muted)]">ถึงวันที่</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-8 w-[150px] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-muted)]">ค้นหาเลขออเดอร์</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                  placeholder="เลขออเดอร์..."
                  className="pl-8 w-[180px] text-sm"
                />
              </div>
            </div>
            
            <Button
              type="button"
              size="sm"
              onClick={handleFilter}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              กรอง
            </Button>
            
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilter}
                className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
              >
                <X className="w-4 h-4 mr-1" />
                ล้าง
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="จำนวนออเดอร์"
          value={data?.totalOrders.toLocaleString() ?? '-'}
          subtitle="ออเดอร์ที่มีการเบิก"
          icon={FileText}
          variant="primary"
        />
        <StatCard
          title="รายการสินค้า"
          value={data?.totalItems.toLocaleString() ?? '-'}
          subtitle="รายการทั้งหมด"
          icon={Layers}
          variant="info"
        />
        <StatCard
          title="จำนวนรวม"
          value={data?.totalQty.toLocaleString() ?? '-'}
          subtitle="ชิ้น"
          icon={Package}
          variant="success"
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
            รายละเอียดออเดอร์
            {data && data.orders.length > 0 && (
              <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
                {data.orders.length} ออเดอร์
              </Badge>
            )}
          </CardTitle>
          {data && data.orders.length > 0 && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll}>
                ขยายทั้งหมด
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                ย่อทั้งหมด
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : !data || data.orders.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="ไม่มีข้อมูลออเดอร์"
                description="ไม่พบข้อมูลการเบิกที่มีเลขออเดอร์ในช่วงเวลาที่เลือก"
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-default)]">
              {data.orders.map((order) => {
                const isExpanded = expandedOrders.has(order.orderRef)
                return (
                  <Collapsible
                    key={order.orderRef}
                    open={isExpanded}
                    onOpenChange={() => toggleOrder(order.orderRef)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer">
                        <div className="flex items-center gap-4">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                          <div className="text-left">
                            <div className="font-mono font-semibold text-[var(--accent-primary)]">
                              {order.orderRef}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {formatDateTime(order.lastIssueDate, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-sm text-[var(--text-muted)]">รายการ</div>
                            <div className="font-semibold">{order.itemCount}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-[var(--text-muted)]">จำนวนรวม</div>
                            <div className="font-mono font-bold text-[var(--status-success)]">
                              {order.totalQty.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-[var(--bg-secondary)] border-t border-[var(--border-default)]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-12">SKU</TableHead>
                              <TableHead>สินค้า</TableHead>
                              <TableHead>Variant</TableHead>
                              <TableHead>เลขเอกสาร</TableHead>
                              <TableHead>วันที่เบิก</TableHead>
                              <TableHead className="text-right">จำนวน</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.items.map((item, idx) => (
                              <TableRow key={`${order.orderRef}-${idx}`}>
                                <TableCell className="pl-12 font-mono text-sm">
                                  <Link
                                    href={`/products/${item.productId}`}
                                    className="text-[var(--accent-primary)] hover:underline"
                                  >
                                    {item.sku}
                                  </Link>
                                </TableCell>
                                <TableCell className="font-medium">{item.productName}</TableCell>
                                <TableCell className="text-[var(--text-muted)]">
                                  {item.variantName || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-[var(--text-muted)]">
                                  {item.movementDocNumber}
                                </TableCell>
                                <TableCell className="text-sm text-[var(--text-muted)]">
                                  {formatDateTime(item.issuedAt, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  {item.qty.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
