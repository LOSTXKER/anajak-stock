'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, Eye, ClipboardList, Loader2 } from 'lucide-react'
import { GRNStatus } from '@/generated/prisma'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { EmptyState } from '@/components/common'

const statusConfig: Record<GRNStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  POSTED: { label: 'บันทึกแล้ว', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
}

interface GRN {
  id: string
  grnNumber: string
  status: GRNStatus
  receivedDate: Date
  createdAt: Date
  po: {
    poNumber: string
    supplier: { name: string } | null
  } | null
  receivedBy: { name: string | null; username: string } | null
  lines: { qtyReceived: number }[]
}

export function GRNList() {
  const [grns, setGRNs] = useState<GRN[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<GRNStatus | undefined>()

  useEffect(() => {
    loadData()
  }, [page, statusFilter])

  async function loadData() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/grn?page=${page}&limit=10${statusFilter ? `&status=${statusFilter}` : ''}`)
      if (response.ok) {
        const data = await response.json()
        setGRNs(data.items)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Failed to load GRNs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!statusFilter ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(undefined); setPage(1) }}
            >
              ทั้งหมด
            </Button>
            {Object.entries(statusConfig).map(([key, config]) => (
              <Button
                key={key}
                variant={statusFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setStatusFilter(key as GRNStatus); setPage(1) }}
              >
                {config.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่ GRN</TableHead>
                <TableHead>อ้างอิง PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-center">จำนวน</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead>วันที่รับ</TableHead>
                <TableHead>ผู้รับ</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <EmptyState
                      icon={<ClipboardList className="w-8 h-8" />}
                      title="ไม่มีใบรับสินค้า"
                      description="รับสินค้าจาก PO ที่อนุมัติแล้ว"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                grns.map((grn) => {
                  const totalQty = grn.lines.reduce((sum, l) => sum + Number(l.qtyReceived), 0)
                  return (
                    <TableRow key={grn.id}>
                      <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                        <Link href={`/grn/${grn.id}`} className="hover:underline">
                          {grn.grnNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {grn.po?.poNumber || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {grn.po?.supplier?.name || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{totalQty}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={statusConfig[grn.status].color}>
                          {statusConfig[grn.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {format(new Date(grn.receivedDate), 'd MMM yy', { locale: th })}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {grn.receivedBy?.name || grn.receivedBy?.username || '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/grn/${grn.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-muted)]">
            แสดง {grns.length} จาก {total} รายการ
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1.5 text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
