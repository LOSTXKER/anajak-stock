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
import { ChevronLeft, ChevronRight, Eye, FileText, Loader2 } from 'lucide-react'
import { PRStatus } from '@/generated/prisma'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { EmptyState } from '@/components/common'
import { getPRs } from '@/actions/pr'

const statusConfig: Record<PRStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
  SUBMITTED: { label: 'รออนุมัติ', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  APPROVED: { label: 'อนุมัติแล้ว', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  REJECTED: { label: 'ปฏิเสธ', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
  CONVERTED: { label: 'แปลงเป็น PO', color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
}

interface PRLine {
  qty: number
  product: { standardCost: number | null }
}

interface PR {
  id: string
  prNumber: string
  title: string | null
  status: PRStatus
  createdAt: Date
  requiredDate: Date | null
  requestedBy: { id: string; name: string | null; username: string } | null
  lines: PRLine[]
  _count: { lines: number }
}

export function PRList() {
  const [prs, setPrs] = useState<PR[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<PRStatus | undefined>()

  useEffect(() => {
    loadData()
  }, [page, statusFilter])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getPRs({ page, limit: 10, status: statusFilter })
      setPrs(result.items as unknown as PR[])
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to load PRs:', error)
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
                onClick={() => { setStatusFilter(key as PRStatus); setPage(1) }}
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
                <TableHead>เลขที่ PR</TableHead>
                <TableHead>หัวข้อ</TableHead>
                <TableHead>ผู้ขอ</TableHead>
                <TableHead className="text-right">มูลค่า</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <EmptyState
                      icon={<FileText className="w-8 h-8" />}
                      title="ไม่มีใบขอซื้อ"
                      description="สร้าง PR เพื่อเริ่มกระบวนการจัดซื้อ"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                prs.map((pr) => (
                  <TableRow key={pr.id}>
                    <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                      <Link href={`/pr/${pr.id}`} className="hover:underline">
                        {pr.prNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {pr.title || '-'}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {pr.requestedBy?.name || pr.requestedBy?.username || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ฿{pr.lines?.reduce((sum, line) => sum + Number(line.qty) * Number(line.product?.standardCost || 0), 0).toLocaleString() || '0'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusConfig[pr.status].color}>
                        {statusConfig[pr.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)] text-sm">
                      {format(new Date(pr.createdAt), 'd MMM yy', { locale: th })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/pr/${pr.id}`}>
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
            แสดง {prs.length} จาก {total} รายการ
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
