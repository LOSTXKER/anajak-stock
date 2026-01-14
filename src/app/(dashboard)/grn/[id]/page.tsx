import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, ClipboardCheck, User, Calendar, Package, FileText, CheckCircle2, XCircle, Link2, ShoppingCart } from 'lucide-react'
import { GRNActions } from './grn-actions'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface PageProps {
  params: Promise<{ id: string }>
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  DRAFT: { 
    color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
    icon: <FileText className="w-3.5 h-3.5" />,
    label: 'ร่าง'
  },
  POSTED: { 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'บันทึกแล้ว'
  },
  CANCELLED: { 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'ยกเลิก'
  },
}

async function getGRN(id: string) {
  return prisma.gRN.findUnique({
    where: { id },
    include: {
      po: {
        include: {
          supplier: true,
        },
      },
      receivedBy: {
        select: { id: true, name: true, email: true },
      },
      lines: {
        include: {
          product: {
            include: {
              unit: true,
            },
          },
          variant: true,
        },
      },
    },
  })
}

async function GRNDetail({ id }: { id: string }) {
  const [grn, session] = await Promise.all([
    getGRN(id),
    getSession(),
  ])

  if (!grn) {
    notFound()
  }

  const statusInfo = statusConfig[grn.status] || statusConfig.DRAFT

  // Check permissions
  const userRole = session?.role || 'VIEWER'
  const canPost = grn.status === 'DRAFT' && ['ADMIN', 'MANAGER', 'WAREHOUSE_MANAGER'].includes(userRole)

  const totalQty = grn.lines.reduce((sum, line) => sum + Number(line.qtyReceived), 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/grn">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{grn.grnNumber}</h1>
              <Badge className={statusInfo.color}>
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.label}</span>
              </Badge>
            </div>
            <p className="text-[var(--text-muted)] mt-1">
              รับเมื่อ {format(new Date(grn.receivedAt), 'd MMMM yyyy HH:mm น.', { locale: th })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <GRNActions
          grnId={grn.id}
          status={grn.status}
          canPost={canPost}
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <User className="w-4 h-4" />
              ผู้รับสินค้า
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{grn.receivedBy.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{grn.receivedBy.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              วันที่รับ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{format(new Date(grn.receivedAt), 'd/M/yyyy', { locale: th })}</p>
            <p className="text-sm text-[var(--text-muted)]">{format(new Date(grn.receivedAt), 'HH:mm น.')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <Package className="w-4 h-4" />
              จำนวนรับ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--accent-primary)]">{totalQty.toLocaleString()}</p>
            <p className="text-sm text-[var(--text-muted)]">{grn.lines.length} รายการ</p>
          </CardContent>
        </Card>

      </div>

      {/* Linked PO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
            เอกสารที่เกี่ยวข้อง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/po/${grn.poId}`}
            className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-[var(--accent-primary)]" />
              <div>
                <p className="font-medium">{grn.po.poNumber}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {grn.po.supplier.name}
                </p>
              </div>
            </div>
            <Badge variant="secondary">{grn.po.status}</Badge>
          </Link>
        </CardContent>
      </Card>

      {/* Note */}
      {grn.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)]">หมายเหตุ</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{grn.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสินค้าที่รับ
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {grn.lines.length} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead className="text-right">จำนวนรับ</TableHead>
                <TableHead>หน่วย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-[var(--text-muted)]">{index + 1}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/products/${line.product.id}`}
                      className="text-[var(--accent-primary)] hover:underline"
                    >
                      {line.variant?.sku || line.product.sku}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    {line.product.name}
                    {line.variant && (
                      <span className="text-[var(--text-muted)] text-sm ml-1">
                        ({line.variant.name || line.variant.sku})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {Number(line.qtyReceived).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-[var(--text-muted)]">
                    {line.product.unit?.name || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-[var(--bg-secondary)]">
                <TableCell colSpan={4} className="text-right font-medium">
                  รวมทั้งหมด
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-[var(--accent-primary)] text-lg">
                  {totalQty.toLocaleString()}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function GRNDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <GRNDetail id={id} />
    </Suspense>
  )
}
