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
import { ChevronLeft, ChevronRight, Eye, ShoppingCart, Loader2 } from 'lucide-react'
import { POStatus } from '@/generated/prisma'
import { EmptyState } from '@/components/common'
import { formatDate } from '@/lib/date'
import { getPOs } from '@/actions/po'

const statusConfig: Record<POStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  SUBMITTED: { label: 'รออนุมัติ', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  APPROVED: { label: 'อนุมัติแล้ว', color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]' },
  REJECTED: { label: 'ไม่อนุมัติ', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
  SENT: { label: 'ส่งแล้ว', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  PARTIALLY_RECEIVED: { label: 'รับบางส่วน', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  FULLY_RECEIVED: { label: 'รับครบ', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  CLOSED: { label: 'ปิดแล้ว', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
}

interface PO {
  id: string
  poNumber: string
  status: POStatus
  total: number | null
  createdAt: Date
  eta: Date | null
  supplier: { id: string; name: string; code: string } | null
  _count: { lines: number }
}

export function POList() {
  const [pos, setPOs] = useState<PO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<POStatus | undefined>()

  useEffect(() => {
    loadData()
  }, [page, statusFilter])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getPOs({ page, limit: 10, status: statusFilter })
      setPOs(result.items as unknown as PO[])
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to load POs:', error)
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
            {Object.entries(statusConfig).slice(0, 5).map(([key, config]) => (
              <Button
                key={key}
                variant={statusFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setStatusFilter(key as POStatus); setPage(1) }}
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
                <TableHead>เลขที่ PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">มูลค่า</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead>กำหนดส่ง</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <EmptyState
                      icon={<ShoppingCart className="w-8 h-8" />}
                      title="ไม่มีใบสั่งซื้อ"
                      description="สร้าง PO จาก PR ที่อนุมัติแล้ว"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                      <Link href={`/po/${po.id}`} className="hover:underline">
                        {po.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {po.supplier?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ฿{Number(po.total || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusConfig[po.status].color}>
                        {statusConfig[po.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)] text-sm">
                      {formatDate(po.createdAt)}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)] text-sm">
                      {formatDate(po.eta)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/po/${po.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-muted)]">
            แสดง {pos.length} จาก {total} รายการ
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
