import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
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
import { ClipboardList, CheckCircle2, XCircle, FileText } from 'lucide-react'
import { GRNStatus } from '@/generated/prisma'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { PageHeader, EmptyState } from '@/components/common'
import { TableSkeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise<{
    page?: string
    status?: GRNStatus
  }>
}

const statusConfig: Record<GRNStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { 
    label: 'ร่าง', 
    color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
    icon: <FileText className="w-3.5 h-3.5" />
  },
  POSTED: { 
    label: 'บันทึกแล้ว', 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />
  },
  CANCELLED: { 
    label: 'ยกเลิก', 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    icon: <XCircle className="w-3.5 h-3.5" />
  },
}

async function getGRNs(params: { page: number; limit: number; status?: GRNStatus }) {
  const { page, limit, status } = params

  const where = {
    ...(status && { status }),
  }

  const [items, total] = await Promise.all([
    prisma.gRN.findMany({
      where,
      include: {
        po: {
          include: {
            supplier: true,
          },
        },
        receivedBy: {
          select: { id: true, name: true, username: true },
        },
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gRN.count({ where }),
  ])

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

async function GRNContent({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const status = params.status

  const { items: grns, total, totalPages } = await getGRNs({
    page,
    limit: 20,
    status,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="รับสินค้า (GRN)"
          description={`Goods Received Note ทั้งหมด ${total} รายการ`}
          icon={<ClipboardList className="w-6 h-6" />}
        />
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/grn">
          <Button variant={!status ? 'default' : 'outline'} size="sm">
            ทั้งหมด
          </Button>
        </Link>
        {Object.entries(statusConfig).map(([key, config]) => (
          <Link key={key} href={`/grn?status=${key}`}>
            <Button
              variant={status === key ? 'default' : 'outline'}
              size="sm"
            >
              {config.icon}
              <span className="ml-1">{config.label}</span>
            </Button>
          </Link>
        ))}
      </div>

      {/* GRN Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่ GRN</TableHead>
                <TableHead>เลขที่ PO</TableHead>
                <TableHead>ซัพพลายเออร์</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>รายการ</TableHead>
                <TableHead>ผู้รับ</TableHead>
                <TableHead>วันที่รับ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <EmptyState
                      icon={<ClipboardList className="w-8 h-8" />}
                      title="ไม่พบใบรับสินค้า"
                      description="สร้าง GRN ได้จากหน้า PO ที่ส่งแล้ว"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                grns.map((grn) => {
                  const statusInfo = statusConfig[grn.status]

                  return (
                    <TableRow key={grn.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/grn/${grn.id}`}
                          className="text-[var(--accent-primary)] hover:underline"
                        >
                          {grn.grnNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/po/${grn.poId}`}
                          className="font-mono text-sm text-[var(--status-info)] hover:underline"
                        >
                          {grn.po.poNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {grn.po.supplier.name}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          {statusInfo.icon}
                          <span className="ml-1">{statusInfo.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {grn.lines.length} รายการ
                      </TableCell>
                      <TableCell className="font-medium">
                        {grn.receivedBy.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {format(new Date(grn.receivedAt), 'd MMM yy HH:mm', { locale: th })}
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
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/grn?page=${page - 1}${status ? `&status=${status}` : ''}`}>
              <Button variant="outline" size="sm">
                ก่อนหน้า
              </Button>
            </Link>
          )}
          <span className="text-[var(--text-muted)] text-sm">
            หน้า {page} จาก {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/grn?page=${page + 1}${status ? `&status=${status}` : ''}`}>
              <Button variant="outline" size="sm">
                ถัดไป
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default function GRNPage(props: PageProps) {
  return (
    <Suspense fallback={<div className="space-y-6"><TableSkeleton rows={8} cols={7} /></div>}>
      <GRNContent {...props} />
    </Suspense>
  )
}
