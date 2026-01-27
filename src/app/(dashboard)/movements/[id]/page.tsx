import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { formatDateTime } from '@/lib/date'
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
import { ArrowLeft, ArrowLeftRight, ArrowDown, ArrowUp, RefreshCw, CornerDownRight, FolderOpen, AlertCircle } from 'lucide-react'
import { MovementStats } from './movement-stats'
import { MovementActions } from './movement-actions'
import { MovementAttachments } from './movement-attachments'
import { LinkedMovements } from './linked-movements'
import { EmptyState } from '@/components/common'
import { movementStatusConfig } from '@/lib/status-config'
import { hasPermission } from '@/lib/permissions'
import { DocStatus, Role } from '@/generated/prisma'

interface PageProps {
  params: Promise<{ id: string }>
}

const typeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  RECEIVE: { 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <ArrowDown className="w-3.5 h-3.5" />,
    label: 'รับเข้า'
  },
  ISSUE: { 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    icon: <ArrowUp className="w-3.5 h-3.5" />,
    label: 'เบิกออก'
  },
  TRANSFER: { 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
    icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
    label: 'โอนย้าย'
  },
  ADJUST: { 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    label: 'ปรับปรุง'
  },
  RETURN: { 
    color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
    icon: <CornerDownRight className="w-3.5 h-3.5" />,
    label: 'คืน'
  },
}

async function getMovement(id: string) {
  return prisma.stockMovement.findUnique({
    where: { id },
    include: {
      createdBy: true,
      approvedBy: true,
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
          fromLocation: {
            include: {
              warehouse: true,
            },
          },
          toLocation: {
            include: {
              warehouse: true,
            },
          },
        },
      },
    },
  })
}

async function MovementDetail({ id }: { id: string }) {
  const [movement, session] = await Promise.all([
    getMovement(id),
    getSession(),
  ])

  if (!movement) {
    notFound()
  }

  const totalQty = movement.lines.reduce((sum, line) => sum + Number(line.qty), 0)
  const typeInfo = typeConfig[movement.type] || typeConfig.ISSUE
  const statusInfo = movementStatusConfig[movement.status as DocStatus] || movementStatusConfig.DRAFT

  // Check permissions
  const userRole = (session?.role || 'VIEWER') as Role
  const canApprove = hasPermission(userRole, 'movements:approve', session?.customPermissions)
  const canEdit = movement.createdById === session?.id || hasPermission(userRole, 'movements:write', session?.customPermissions)

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
            <Link href="/movements">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{movement.docNumber}</h1>
              <Badge className={typeInfo.color}>
                {typeInfo.icon}
                <span className="ml-1">{typeInfo.label}</span>
              </Badge>
              <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.label}</span>
              </Badge>
              {movement.projectCode && (
                <Badge variant="outline" className="text-[var(--text-secondary)]">
                  <FolderOpen className="w-3 h-3 mr-1" />
                  {movement.projectCode}
                </Badge>
              )}
            </div>
            <p className="text-[var(--text-muted)] mt-1">
              {formatDateTime(movement.createdAt, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <MovementActions
          movementId={movement.id}
          status={movement.status}
          type={movement.type}
          canApprove={canApprove}
          canEdit={canEdit}
        />
      </div>

      {/* Stats Cards */}
      <MovementStats
        createdByName={movement.createdBy?.name || null}
        createdAt={movement.createdAt}
        totalQty={totalQty}
        linesCount={movement.lines.length}
        approvedByName={movement.approvedBy?.name}
        postedAt={movement.postedAt}
      />

      {/* Note & Reason */}
      {(movement.note || movement.reason) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {movement.reason && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-muted)]">เหตุผล</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{movement.reason}</p>
              </CardContent>
            </Card>
          )}
          {movement.note && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-muted)]">หมายเหตุ</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{movement.note}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสินค้า
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {movement.lines.length} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>จาก</TableHead>
                <TableHead>ไป</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead>หน่วย</TableHead>
                <TableHead className="text-right">ราคาทุน</TableHead>
                <TableHead>หมายเหตุ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movement.lines.map((line, index) => {
                // สร้างชื่อ variant จาก option values
                const variantName = line.variant?.optionValues
                  ?.map((ov) => ov.optionValue.value)
                  .join(', ') || line.variant?.name
                
                const unitCost = Number(line.unitCost)
                const totalLineCost = unitCost * Number(line.qty)
                
                return (
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
                  <TableCell>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{line.product.name}</p>
                      {variantName && (
                        <p className="text-sm text-[var(--text-muted)]">{variantName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-muted)]">
                    {line.fromLocation
                      ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs font-normal">
                            {line.fromLocation.warehouse.name}
                          </Badge>
                          <span className="font-mono">{line.fromLocation.code}</span>
                        </div>
                      )
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-muted)]">
                    {line.toLocation
                      ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs font-normal">
                            {line.toLocation.warehouse.name}
                          </Badge>
                          <span className="font-mono">{line.toLocation.code}</span>
                        </div>
                      )
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {Number(line.qty).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-[var(--text-muted)]">
                    {line.product.unit?.name || '-'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {unitCost > 0 ? (
                      <div>
                        <p className="font-mono">฿{unitCost.toLocaleString()}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          รวม ฿{totalLineCost.toLocaleString()}
                        </p>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-muted)] max-w-[150px] truncate">
                    {line.note || '-'}
                  </TableCell>
                </TableRow>
              )})}
              
              {/* Totals Row */}
              <TableRow className="bg-[var(--bg-secondary)]">
                <TableCell colSpan={5} className="text-right font-medium">
                  รวมทั้งหมด
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-[var(--accent-primary)] text-lg">
                  {totalQty.toLocaleString()}
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-mono font-medium text-[var(--accent-primary)]">
                  ฿{movement.lines.reduce((sum, line) => sum + (Number(line.unitCost) * Number(line.qty)), 0).toLocaleString()}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Linked Movements */}
      <LinkedMovements movementId={movement.id} />

      {/* Attachments */}
      <MovementAttachments
        movementId={movement.id}
        readOnly={movement.status === 'POSTED' || movement.status === 'CANCELLED'}
      />
    </div>
  )
}

export default async function MovementDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <MovementDetail id={id} />
    </Suspense>
  )
}
