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
import { Clock, Download, AlertTriangle, Package, Calendar } from 'lucide-react'
import { getExpiringLots, getExpiredLots } from '@/actions/lots'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface LotItem {
  id: string
  lotNumber: string
  product: { sku: string; name: string; category: { name: string } | null }
  variant: { sku: string; name: string | null } | null
  expiryDate: Date | null
  totalQtyOnHand: number
  daysUntilExpiry?: number | null
  daysSinceExpiry?: number | null
}

export default function ExpiringLotsPage() {
  const [period, setPeriod] = useState<'7' | '30' | '60' | '90'>('30')
  const [activeTab, setActiveTab] = useState('expiring')
  const [expiringLots, setExpiringLots] = useState<LotItem[]>([])
  const [expiredLots, setExpiredLots] = useState<LotItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [expiringResult, expiredResult] = await Promise.all([
          getExpiringLots(Number(period)),
          getExpiredLots(),
        ])

        if (expiringResult.success) {
          setExpiringLots(expiringResult.data.map(lot => ({
            ...lot,
            expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : null,
          })))
        }
        if (expiredResult.success) {
          setExpiredLots(expiredResult.data.map(lot => ({
            ...lot,
            expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : null,
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

  const getSeverityBadge = (days: number | null | undefined, isExpired: boolean) => {
    if (isExpired) {
      return <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)] border-[var(--status-error)]/30">หมดอายุแล้ว</Badge>
    }
    if (days === null || days === undefined) return null
    if (days <= 7) {
      return <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)] border-[var(--status-error)]/30">วิกฤต</Badge>
    }
    if (days <= 14) {
      return <Badge className="bg-[var(--status-warning-light)] text-[var(--status-warning)] border-[var(--status-warning)]/30">เร่งด่วน</Badge>
    }
    if (days <= 30) {
      return <Badge className="bg-[var(--status-info-light)] text-[var(--status-info)] border-[var(--status-info)]/30">เตือน</Badge>
    }
    return <Badge className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-default)]">ติดตาม</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[var(--status-warning)]" />
            สินค้าใกล้หมดอายุ / หมดอายุ
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            ติดตาม Lot/Batch ที่ใกล้หมดอายุหรือหมดอายุแล้ว
          </p>
        </div>
        <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--status-error)]" />
              หมดอายุแล้ว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--status-error)]">{expiredLots.length}</div>
            <p className="text-[var(--text-muted)] text-sm">Lot ที่หมดอายุ</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--status-warning)]" />
              ใกล้หมดอายุ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--status-warning)]">{expiringLots.length}</div>
            <p className="text-[var(--text-muted)] text-sm">Lot ใน {period} วันข้างหน้า</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--accent-primary)]" />
              จำนวนสินค้า
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--accent-primary)]">
              {(expiringLots.reduce((sum, l) => sum + l.totalQtyOnHand, 0) +
                expiredLots.reduce((sum, l) => sum + l.totalQtyOnHand, 0)).toLocaleString()}
            </div>
            <p className="text-[var(--text-muted)] text-sm">ชิ้นที่ต้องจัดการ</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
            <TabsTrigger value="expiring" className="data-[state=active]:bg-[var(--status-warning)]">
              <Clock className="w-4 h-4 mr-2" />
              ใกล้หมดอายุ ({expiringLots.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="data-[state=active]:bg-[var(--status-error)]">
              <AlertTriangle className="w-4 h-4 mr-2" />
              หมดอายุแล้ว ({expiredLots.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === 'expiring' && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)] text-sm">ช่วงเวลา:</span>
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-32 bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectItem value="7" className="text-[var(--text-secondary)]">7 วัน</SelectItem>
                  <SelectItem value="30" className="text-[var(--text-secondary)]">30 วัน</SelectItem>
                  <SelectItem value="60" className="text-[var(--text-secondary)]">60 วัน</SelectItem>
                  <SelectItem value="90" className="text-[var(--text-secondary)]">90 วัน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Expiring Tab */}
        <TabsContent value="expiring">
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-[var(--text-primary)]">Lot ที่ใกล้หมดอายุ</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
              ) : expiringLots.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-[var(--status-success)]" />
                    <p>ไม่มีสินค้าใกล้หมดอายุ</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                      <TableHead className="text-[var(--text-muted)]">Lot Number</TableHead>
                      <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                      <TableHead className="text-[var(--text-muted)]">ชื่อสินค้า</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">จำนวน</TableHead>
                      <TableHead className="text-[var(--text-muted)]">วันหมดอายุ</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">เหลืออีก</TableHead>
                      <TableHead className="text-[var(--text-muted)]">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringLots.map((lot) => (
                      <TableRow key={lot.id} className="border-[var(--border-default)] hover:bg-[var(--bg-hover)]">
                        <TableCell className="font-mono text-[var(--status-warning)]">{lot.lotNumber}</TableCell>
                        <TableCell className="font-mono text-[var(--text-secondary)]">
                          {lot.variant?.sku || lot.product.sku}
                        </TableCell>
                        <TableCell className="text-[var(--text-primary)]">{lot.product.name}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {lot.totalQtyOnHand.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)]">
                          {lot.expiryDate?.toLocaleDateString('th-TH')}
                        </TableCell>
                        <TableCell className="text-right text-[var(--status-warning)] font-semibold">
                          {lot.daysUntilExpiry} วัน
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(lot.daysUntilExpiry, false)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expired Tab */}
        <TabsContent value="expired">
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-[var(--text-primary)]">Lot ที่หมดอายุแล้ว</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
                </div>
              ) : expiredLots.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-[var(--text-muted)]">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-[var(--status-success)]" />
                    <p>ไม่มีสินค้าหมดอายุ</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                      <TableHead className="text-[var(--text-muted)]">Lot Number</TableHead>
                      <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                      <TableHead className="text-[var(--text-muted)]">ชื่อสินค้า</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">จำนวน</TableHead>
                      <TableHead className="text-[var(--text-muted)]">วันหมดอายุ</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">หมดไปแล้ว</TableHead>
                      <TableHead className="text-[var(--text-muted)]">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiredLots.map((lot) => (
                      <TableRow key={lot.id} className="border-[var(--border-default)] hover:bg-[var(--bg-hover)]">
                        <TableCell className="font-mono text-[var(--status-error)]">{lot.lotNumber}</TableCell>
                        <TableCell className="font-mono text-[var(--text-secondary)]">
                          {lot.variant?.sku || lot.product.sku}
                        </TableCell>
                        <TableCell className="text-[var(--text-primary)]">{lot.product.name}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {lot.totalQtyOnHand.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)]">
                          {lot.expiryDate?.toLocaleDateString('th-TH')}
                        </TableCell>
                        <TableCell className="text-right text-[var(--status-error)] font-semibold">
                          {lot.daysSinceExpiry} วัน
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(null, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
