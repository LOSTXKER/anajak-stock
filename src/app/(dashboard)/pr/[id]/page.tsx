import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { formatDateTime, formatDate } from '@/lib/date'
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
import { ArrowLeft, FileText, User, AlertCircle, ShoppingCart, Link2, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { PRActions } from './pr-actions'
import { CopyOrderText } from '@/components/copy-order-text'
import { prStatusConfig, poStatusConfig } from '@/lib/status-config'
import { hasPermission } from '@/lib/permissions'
import { PRStatus, POStatus, Role } from '@/generated/prisma'

interface PageProps {
  params: Promise<{ id: string }>
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  LOW: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: 'ต่ำ' },
  NORMAL: { color: 'bg-[var(--status-info-light)] text-[var(--status-info)]', label: 'ปกติ' },
  MEDIUM: { color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]', label: 'ปานกลาง' },
  HIGH: { color: 'bg-[var(--status-error-light)] text-[var(--status-error)]', label: 'สูง' },
  URGENT: { color: 'bg-[var(--status-error)] text-white', label: 'เร่งด่วน' },
}

async function getPR(id: string) {
  return prisma.pR.findUnique({
    where: { id },
    include: {
      requester: true,
      approver: true,
      lines: {
        include: {
          product: {
            include: {
              unit: true,
            },
          },
          variant: {
            include: {
              optionValues: {
                include: {
                  optionValue: {
                    include: {
                      optionType: true,
                    },
                  },
                },
                orderBy: {
                  optionValue: {
                    optionType: { displayOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
      // Include linked POs for document trail
      pos: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          total: true,
          createdAt: true,
          supplier: {
            select: { name: true },
          },
        },
      },
    },
  })
}

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { deletedAt: null, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

async function PRDetail({ id }: { id: string }) {
  const [pr, session, suppliers] = await Promise.all([
    getPR(id),
    getSession(),
    getSuppliers(),
  ])

  if (!pr) {
    notFound()
  }

  const userRole = (session?.role || 'VIEWER') as Role
  
  const canApprove =
    session &&
    hasPermission(userRole, 'pr:approve', session.customPermissions) &&
    pr.status === 'SUBMITTED'

  const canEdit =
    session &&
    (hasPermission(userRole, 'pr:write', session.customPermissions) || session.id === pr.requesterId) &&
    pr.status === 'DRAFT'

  const statusInfo = prStatusConfig[pr.status as PRStatus] || prStatusConfig.DRAFT
  const priority = priorityConfig[pr.priority || 'NORMAL'] || priorityConfig.NORMAL

  return (
    <div className="space-y-6">
      {/* Action Required Banner */}
      {statusInfo.type === 'action_required' && statusInfo.actionHint && (
        <div className="bg-[var(--status-warning-light)] border border-[var(--status-warning)]/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0" />
          <div>
            <p className="font-medium text-[var(--status-warning)]">ต้องดำเนินการ</p>
            <p className="text-sm text-[var(--text-secondary)]">{statusInfo.actionHint}</p>
          </div>
        </div>
      )}

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
              <h1 className="text-2xl font-bold">{pr.prNumber}</h1>
              <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.label}</span>
              </Badge>
            </div>
            <p className="text-[var(--text-muted)] mt-1">
              สร้างเมื่อ {formatDateTime(pr.createdAt, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CopyOrderText
            docNumber={pr.prNumber}
            docType="PR"
            lines={pr.lines.map((line) => ({
              productName: line.product.name,
              variantName: line.variant?.optionValues
                ?.map((ov) => ov.optionValue.value)
                .join(', ') || line.variant?.name || undefined,
              sku: line.variant?.sku || line.product.sku,
              qty: Number(line.qty),
            }))}
            note={pr.note || undefined}
          />
          <PRActions
            prId={pr.id}
            prStatus={pr.status}
            canApprove={!!canApprove}
            canEdit={!!canEdit}
            suppliers={suppliers}
          />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <User className="w-4 h-4" />
              ผู้ขอ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{pr.requester.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{pr.requester.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              ความสำคัญ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={priority.color}>{priority.label}</Badge>
            {pr.needByDate && (
              <p className="text-sm text-[var(--text-muted)] mt-2">
                ต้องการภายใน: {formatDate(pr.needByDate)}
              </p>
            )}
          </CardContent>
        </Card>

        {pr.approver && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                ผู้อนุมัติ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{pr.approver.name}</p>
              {pr.approvedAt && (
                <p className="text-sm text-[var(--text-muted)]">
                  {formatDate(pr.approvedAt)}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rejected Reason */}
      {pr.status === 'REJECTED' && pr.rejectedReason && (
        <Card className="border-[var(--status-error)]/30 bg-[var(--status-error)]/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--status-error)] flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              เหตุผลที่ปฏิเสธ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{pr.rejectedReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Document Trail - Linked POs */}
      {pr.pos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
              เอกสารที่เกี่ยวข้อง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pr.pos.map((po) => (
                <Link
                  key={po.id}
                  href={`/po/${po.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-[var(--accent-primary)]" />
                    <div>
                      <p className="font-medium">{po.poNumber}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {po.supplier.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">฿{Number(po.total).toLocaleString()}</p>
                    <Badge className={`text-xs ${poStatusConfig[po.status as POStatus].bgColor} ${poStatusConfig[po.status as POStatus].color}`}>
                      {poStatusConfig[po.status as POStatus].icon}
                      <span className="ml-1">{poStatusConfig[po.status as POStatus].shortLabel || poStatusConfig[po.status as POStatus].label}</span>
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Note */}
      {pr.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-muted)]">หมายเหตุ / เหตุผลในการขอซื้อ</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{pr.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสินค้า
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {pr.lines.length} รายการ
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
                <TableHead>หน่วย</TableHead>
                <TableHead>หมายเหตุ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pr.lines.map((line, index) => {
                // สร้างชื่อ variant จาก option values
                const variantName = line.variant?.optionValues
                  ?.map((ov) => ov.optionValue.value)
                  .join(', ') || line.variant?.name

                return (
                  <TableRow key={line.id}>
                    <TableCell className="text-[var(--text-muted)]">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link href={`/products/${line.product.id}`} className="text-[var(--accent-primary)] hover:underline">
                        {line.variant?.sku || line.product.sku}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{line.product.name}</p>
                        {variantName && (
                          <p className="text-sm text-[var(--text-muted)]">{variantName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {Number(line.qty).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {line.product.unit?.name || '-'}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">{line.note || '-'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PRDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <PRDetail id={id} />
    </Suspense>
  )
}
