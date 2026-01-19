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
import { ArrowLeft, ShoppingCart, Truck, Clock, CheckCircle2, XCircle, Package, Send, Building2, FileText, Link2 } from 'lucide-react'
import { POStats } from './po-stats'
import { POActions } from './po-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  DRAFT: { 
    color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'แบบร่าง'
  },
  SUBMITTED: { 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'รออนุมัติ'
  },
  APPROVED: { 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'อนุมัติแล้ว'
  },
  REJECTED: { 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'ไม่อนุมัติ'
  },
  SENT: { 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
    icon: <Send className="w-3.5 h-3.5" />,
    label: 'ส่งแล้ว'
  },
  IN_PROGRESS: { 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'กำลังดำเนินการ'
  },
  PARTIALLY_RECEIVED: { 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    icon: <Package className="w-3.5 h-3.5" />,
    label: 'รับบางส่วน'
  },
  FULLY_RECEIVED: { 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'รับครบแล้ว'
  },
  CLOSED: { 
    color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'ปิดแล้ว'
  },
  CANCELLED: { 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'ยกเลิก'
  },
}

async function getPO(id: string) {
  return prisma.pO.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: true,
      approvedBy: true,
      pr: {
        select: { id: true, prNumber: true, status: true },
      },
      lines: {
        include: {
          product: {
            include: {
              unit: true,
            },
          },
        },
      },
      grns: {
        select: {
          id: true,
          grnNumber: true,
          status: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: 'desc' },
      },
      timelines: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

async function PODetail({ id }: { id: string }) {
  const [po, session] = await Promise.all([getPO(id), getSession()])

  if (!po) {
    notFound()
  }

  const totalAmount = po.lines.reduce(
    (sum, line) => sum + Number(line.qty) * Number(line.unitPrice),
    0
  )

  const totalReceived = po.lines.reduce((sum, line) => sum + Number(line.qtyReceived), 0)
  const totalOrdered = po.lines.reduce((sum, line) => sum + Number(line.qty), 0)
  const receivePercentage = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0

  const status = statusConfig[po.status] || statusConfig.DRAFT
  
  const canApprove =
    session &&
    (session.role === 'ADMIN' || session.role === 'APPROVER' || session.role === 'PURCHASING') &&
    po.status === 'SUBMITTED'

  const canEdit =
    session &&
    (session.role === 'ADMIN' || session.role === 'PURCHASING') &&
    (po.status === 'DRAFT' || po.status === 'REJECTED')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/purchasing">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{po.poNumber}</h1>
              <Badge className={status.color}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
            </div>
            <p className="text-[var(--text-muted)] mt-1">
              สร้างเมื่อ {new Date(po.createdAt).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <POActions
          poId={po.id}
          poStatus={po.status}
          canApprove={!!canApprove}
          canEdit={!!canEdit}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <POStats
          supplierName={po.supplier.name}
          totalAmount={totalAmount}
          vatType={po.vatType}
          eta={po.eta}
        />
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-[var(--text-muted)]">การรับสินค้า</p>
              <div className="mt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-muted)]">
                    {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()}
                  </span>
                  <span className="font-medium">{receivePercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
                  <div
                    className="bg-[var(--status-success)] h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(receivePercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Trail */}
      {(po.pr || po.grns.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
              เอกสารที่เกี่ยวข้อง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Linked PR */}
              {po.pr && (
                <Link
                  href={`/pr/${po.pr.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[var(--status-info)]" />
                    <div>
                      <p className="font-medium">{po.pr.prNumber}</p>
                      <p className="text-sm text-[var(--text-muted)]">ใบขอซื้อ (PR)</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{po.pr.status}</Badge>
                </Link>
              )}

              {/* Linked GRNs */}
              {po.grns.map((grn) => (
                <Link
                  key={grn.id}
                  href={`/grn/${grn.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-[var(--status-success)]" />
                    <div>
                      <p className="font-medium">{grn.grnNumber}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        รับเมื่อ {new Date(grn.receivedAt).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{grn.status}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplier Info & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              ข้อมูล Supplier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-[var(--text-muted)]">ชื่อ</p>
              <p className="font-medium">{po.supplier.name}</p>
            </div>
            {po.supplier.contactName && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">ผู้ติดต่อ</p>
                <p className="font-medium">{po.supplier.contactName}</p>
              </div>
            )}
            {po.supplier.phone && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">โทรศัพท์</p>
                <p className="font-medium">{po.supplier.phone}</p>
              </div>
            )}
            {po.supplier.email && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">อีเมล</p>
                <p className="font-medium">{po.supplier.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
              ประวัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {po.timelines.length > 0 ? (
              <div className="space-y-3">
                {po.timelines.map((timeline) => (
                  <div key={timeline.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-[var(--accent-primary)]" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{timeline.action}</p>
                      {timeline.note && (
                        <p className="text-sm text-[var(--text-muted)]">{timeline.note}</p>
                      )}
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(timeline.createdAt).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">ยังไม่มีประวัติ</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Note */}
      {po.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)]">หมายเหตุ</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{po.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสินค้า
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {po.lines.length} รายการ
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
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead className="text-right">รับแล้ว</TableHead>
                <TableHead className="text-right">ราคา/หน่วย</TableHead>
                <TableHead className="text-right">รวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-[var(--text-muted)]">{index + 1}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <Link href={`/products/${line.product.id}`} className="text-[var(--accent-primary)] hover:underline">
                      {line.product.sku}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{line.product.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(line.qty).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={Number(line.qtyReceived) >= Number(line.qty) ? 'text-[var(--status-success)]' : ''}>
                      {Number(line.qtyReceived).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ฿{Number(line.unitPrice).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ฿{(Number(line.qty) * Number(line.unitPrice)).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total Row */}
              <TableRow className="bg-[var(--bg-secondary)]">
                <TableCell colSpan={6} className="text-right font-medium">
                  รวมทั้งสิ้น
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-lg">
                  ฿{totalAmount.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PODetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <PODetail id={id} />
    </Suspense>
  )
}
