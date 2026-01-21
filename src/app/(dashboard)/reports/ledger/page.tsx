'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileSpreadsheet, Download, Search, ArrowDown, ArrowUp, ArrowLeftRight, RefreshCw, CornerDownRight } from 'lucide-react'
import { getMovements } from '@/actions/movements'
import { exportMovementsToCSV } from '@/actions/export'
import { MovementType, DocStatus } from '@/generated/prisma'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { MovementWithRelations } from '@/types'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/common'

const typeLabels: Record<MovementType, string> = {
  RECEIVE: 'รับเข้า',
  ISSUE: 'เบิกออก',
  TRANSFER: 'โอนย้าย',
  ADJUST: 'ปรับยอด',
  RETURN: 'คืนของ',
}

const typeConfig: Record<MovementType, { color: string; icon: React.ReactNode }> = {
  RECEIVE: { color: 'bg-[var(--status-success-light)] text-[var(--status-success)]', icon: <ArrowDown className="w-3.5 h-3.5" /> },
  ISSUE: { color: 'bg-[var(--status-error-light)] text-[var(--status-error)]', icon: <ArrowUp className="w-3.5 h-3.5" /> },
  TRANSFER: { color: 'bg-[var(--status-info-light)] text-[var(--status-info)]', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  ADJUST: { color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  RETURN: { color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]', icon: <CornerDownRight className="w-3.5 h-3.5" /> },
}

export default function LedgerReportPage() {
  const [isPending, startTransition] = useTransition()
  const [movements, setMovements] = useState<MovementWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [type, setType] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    loadMovements()
  }, [])

  function loadMovements() {
    startTransition(async () => {
      const result = await getMovements({
        limit: 100,
        type: type as MovementType | undefined,
        status: DocStatus.POSTED,
      })
      setMovements(result.items)
      setTotal(result.total)
    })
  }

  async function handleExport() {
    try {
      const csv = await exportMovementsToCSV({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      })

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `movement-ledger-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('Export สำเร็จ')
    } catch {
      toast.error('Export ไม่สำเร็จ')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Movement Ledger"
          description={`ประวัติการเคลื่อนไหวสินค้าที่ Post แล้ว - ${total} รายการ`}
          icon={<FileSpreadsheet className="w-6 h-6" />}
        />
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs text-[var(--text-muted)]">ประเภท</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[var(--text-muted)]">ตั้งแต่วันที่</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[var(--text-muted)]">ถึงวันที่</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <Button onClick={loadMovements} disabled={isPending}>
              <Search className="w-4 h-4 mr-2" />
              ค้นหา
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>วันที่ Post</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>ตัวเลือก</TableHead>
                <TableHead>จาก</TableHead>
                <TableHead>ไป</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead>ผู้สร้าง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)] mx-auto" />
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <EmptyState
                      icon={<FileSpreadsheet className="w-8 h-8" />}
                      title="ไม่พบรายการ"
                      description="ลองปรับตัวกรองหรือช่วงเวลา"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                movements.flatMap((mov) =>
                  mov.lines.map((line, idx) => {
                    const typeInfo = typeConfig[mov.type]
                    const displaySku = line.variant?.sku || line.product.sku
                    const variantName = line.variant?.name || '-'
                    
                    return (
                      <TableRow key={`${mov.id}-${line.id}`}>
                        {idx === 0 ? (
                          <>
                            <TableCell
                              rowSpan={mov.lines.length}
                              className="font-mono text-sm text-[var(--accent-primary)] align-top"
                            >
                              <Link href={`/movements/${mov.id}`} className="hover:underline">
                                {mov.docNumber}
                              </Link>
                            </TableCell>
                            <TableCell rowSpan={mov.lines.length} className="align-top">
                              <Badge className={typeInfo.color}>
                                {typeInfo.icon}
                                <span className="ml-1">{typeLabels[mov.type]}</span>
                              </Badge>
                            </TableCell>
                            <TableCell
                              rowSpan={mov.lines.length}
                              className="text-[var(--text-muted)] text-sm align-top"
                            >
                              {mov.postedAt
                                ? format(new Date(mov.postedAt), 'd MMM yy HH:mm', { locale: th })
                                : '-'}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className="font-mono text-xs text-[var(--text-muted)]">
                          <Link href={`/products/${line.productId}`} className="hover:text-[var(--accent-primary)]">
                            {displaySku}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {line.product.name}
                        </TableCell>
                        <TableCell className="text-[var(--text-secondary)] text-sm">
                          {variantName}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)] text-sm">
                          {line.fromLocation
                            ? `${line.fromLocation.warehouse.name} / ${line.fromLocation.code}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)] text-sm">
                          {line.toLocation
                            ? `${line.toLocation.warehouse.name} / ${line.toLocation.code}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {Number(line.qty).toLocaleString()}
                        </TableCell>
                        {idx === 0 ? (
                          <TableCell
                            rowSpan={mov.lines.length}
                            className="text-sm align-top"
                          >
                            {mov.createdBy.name}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
