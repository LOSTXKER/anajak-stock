'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
import { History, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, RefreshCw, CornerDownRight, Loader2, ChevronLeft, ChevronRight, Eye, ExternalLink } from 'lucide-react'
import { getMovementsByVariant } from '@/actions/movements'
import { formatDateTime } from '@/lib/date'
import { MovementType, DocStatus } from '@/generated/prisma'

interface Variant {
  id: string
  sku: string
  name: string | null
  options: Array<{
    typeName: string
    value: string
  }>
}

interface VariantMovementHistoryProps {
  productId: string
  productName: string
  variants: Variant[]
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  RECEIVE: { 
    label: 'รับเข้า', 
    icon: ArrowDownToLine, 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
  },
  ISSUE: { 
    label: 'เบิกออก', 
    icon: ArrowUpFromLine, 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
  },
  TRANSFER: { 
    label: 'โอนย้าย', 
    icon: ArrowLeftRight, 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
  },
  ADJUST: { 
    label: 'ปรับยอด', 
    icon: RefreshCw, 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
  },
  RETURN: { 
    label: 'คืนของ', 
    icon: CornerDownRight, 
    color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
  },
}

interface MovementRecord {
  id: string
  docNumber: string
  type: MovementType
  status: DocStatus
  qty: number
  fromLocation: { id: string; code: string; warehouseName: string } | null
  toLocation: { id: string; code: string; warehouseName: string } | null
  note: string | null
  createdAt: Date
  postedAt: Date | null
  createdBy: { id: string; name: string }
}

export function VariantMovementHistory({ productId, productName, variants }: VariantMovementHistoryProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [movements, setMovements] = useState<MovementRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchMovements = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getMovementsByVariant({
        productId,
        variantId: selectedVariantId,
        page,
        limit: 10,
      })
      setMovements(result.items as MovementRecord[])
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to fetch movements:', error)
    } finally {
      setIsLoading(false)
    }
  }, [productId, selectedVariantId, page])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  const getVariantLabel = (variant: Variant) => {
    if (variant.options.length > 0) {
      return variant.options.map(o => o.value).join(' / ')
    }
    return variant.name || variant.sku
  }

  return (
    <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--accent-primary)]" />
            ประวัติเคลื่อนไหว
            {total > 0 && (
              <Badge variant="secondary">{total} รายการ</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            {variants.length > 0 && (
              <Select
                value={selectedVariantId || 'all'}
                onValueChange={(v) => {
                  setSelectedVariantId(v === 'all' ? null : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="ทุกตัวเลือก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกตัวเลือก</SelectItem>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {getVariantLabel(variant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            <span className="ml-2 text-[var(--text-muted)]">กำลังโหลด...</span>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <History className="w-12 h-12 mx-auto opacity-50 mb-3" />
            <p className="font-medium">ไม่พบประวัติเคลื่อนไหว</p>
            <p className="text-sm mt-1">
              {selectedVariantId 
                ? 'ลองเลือกตัวเลือกอื่น หรือดูทั้งหมด'
                : 'ยังไม่มีรายการเคลื่อนไหวของสินค้านี้'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--bg-tertiary)]">
                    <TableHead>เลขที่เอกสาร</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>จำนวน</TableHead>
                    <TableHead>จาก</TableHead>
                    <TableHead>ไป</TableHead>
                    <TableHead>ผู้ทำรายการ</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                    const config = typeConfig[movement.type]
                    const TypeIcon = config?.icon || History

                    return (
                      <TableRow key={`${movement.id}-${movement.type}`}>
                        <TableCell>
                          <Link
                            href={`/movements/${movement.id}`}
                            className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                          >
                            {movement.docNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={config?.color}>
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {config?.label || movement.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            movement.type === 'RECEIVE' || movement.type === 'RETURN'
                              ? 'text-[var(--status-success)]'
                              : movement.type === 'ISSUE'
                              ? 'text-[var(--status-error)]'
                              : ''
                          }`}>
                            {movement.type === 'ISSUE' ? '-' : movement.type === 'RECEIVE' || movement.type === 'RETURN' ? '+' : ''}
                            {Math.abs(movement.qty).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)] text-sm">
                          {movement.fromLocation ? (
                            <span>{movement.fromLocation.warehouseName} - {movement.fromLocation.code}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)] text-sm">
                          {movement.toLocation ? (
                            <span>{movement.toLocation.warehouseName} - {movement.toLocation.code}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)] text-sm">
                          {movement.createdBy.name}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)] text-sm">
                          {formatDateTime(movement.postedAt || movement.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link href={`/movements/${movement.id}`}>
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  ก่อนหน้า
                </Button>
                <span className="text-[var(--text-secondary)] text-sm px-4">
                  หน้า {page} จาก {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  ถัดไป
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
