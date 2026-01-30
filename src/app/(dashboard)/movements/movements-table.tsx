'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Settings2, Eye } from 'lucide-react'
import { MovementType, DocStatus } from '@/generated/prisma'
import { formatDateTime } from '@/lib/date'
import { movementStatusConfig } from '@/lib/status-config'
import { BatchActionBar } from '@/components/batch-action-bar'
import { EmptyState } from '@/components/common'

const typeConfig: Record<MovementType, { label: string; icon: React.ElementType; color: string }> = {
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
    icon: RefreshCw, 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
  },
  ADJUST: { 
    label: 'ปรับยอด', 
    icon: Settings2, 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
  },
  RETURN: { 
    label: 'คืนของ', 
    icon: ArrowLeftRight, 
    color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
  },
}

// Type for movement data
interface MovementData {
  id: string
  docNumber: string
  type: MovementType
  status: DocStatus
  createdAt: Date | string
  createdBy: {
    id: string
    name: string
  }
  lines: Array<{
    id: string
    product: {
      id: string
      name: string
      sku: string
    }
    variant?: {
      id: string
      name: string | null
      sku: string
    } | null
  }>
}

interface MovementsTableProps {
  movements: MovementData[]
  canApprove: boolean
}

export function MovementsTable({ movements, canApprove }: MovementsTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lockedStatus, setLockedStatus] = useState<DocStatus | null>(null)

  // Get the status of selected items (they should all be the same)
  const selectedStatus = useMemo(() => {
    if (selectedIds.length === 0) return null
    const first = movements.find(m => m.id === selectedIds[0])
    return first?.status || null
  }, [selectedIds, movements])

  // Handle single checkbox toggle
  const handleToggle = useCallback((id: string, status: DocStatus) => {
    setSelectedIds(prev => {
      const isSelected = prev.includes(id)
      
      if (isSelected) {
        // Deselecting
        const newSelected = prev.filter(i => i !== id)
        // If no more selected, unlock status
        if (newSelected.length === 0) {
          setLockedStatus(null)
        }
        return newSelected
      } else {
        // Selecting
        // If first selection, lock the status
        if (prev.length === 0) {
          setLockedStatus(status)
        }
        return [...prev, id]
      }
    })
  }, [])

  // Check if a movement can be selected (same status as locked)
  const canSelect = useCallback((status: DocStatus) => {
    if (lockedStatus === null) return true
    return status === lockedStatus
  }, [lockedStatus])

  // Handle select all (only for current status filter)
  const selectableMovements = useMemo(() => {
    if (lockedStatus === null) return movements
    return movements.filter(m => m.status === lockedStatus)
  }, [movements, lockedStatus])

  const allSelectableSelected = selectableMovements.length > 0 && 
    selectableMovements.every(m => selectedIds.includes(m.id))

  const handleSelectAll = useCallback(() => {
    if (allSelectableSelected) {
      // Deselect all
      setSelectedIds([])
      setLockedStatus(null)
    } else {
      // Select all with same status
      if (selectableMovements.length > 0) {
        const firstStatus = selectableMovements[0].status
        // If no lock, set it to first item's status
        if (lockedStatus === null) {
          setLockedStatus(firstStatus)
        }
        // Only select movements with the locked status
        const idsToSelect = selectableMovements
          .filter(m => lockedStatus === null ? m.status === firstStatus : m.status === lockedStatus)
          .map(m => m.id)
        setSelectedIds(idsToSelect)
      }
    }
  }, [selectableMovements, allSelectableSelected, lockedStatus])

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedIds([])
    setLockedStatus(null)
  }, [])

  // On success, refresh the page
  const handleSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  if (movements.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<ArrowLeftRight className="w-12 h-12" />}
            title="ไม่พบรายการเคลื่อนไหว"
            description="ลองเปลี่ยนตัวกรอง หรือสร้างรายการเคลื่อนไหวใหม่"
            action={
              <Button asChild>
                <Link href="/movements/new?type=RECEIVE">
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                  รับเข้าสินค้า
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto mobile-scroll">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelectableSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="เลือกทั้งหมด"
                    />
                  </TableHead>
                  <TableHead>เลขที่เอกสาร</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>ผู้สร้าง</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  const typeInfo = typeConfig[movement.type]
                  const statusInfo = movementStatusConfig[movement.status]
                  const TypeIcon = typeInfo.icon
                  const isSelected = selectedIds.includes(movement.id)
                  const isSelectable = canSelect(movement.status)

                  return (
                    <TableRow 
                      key={movement.id}
                      className={`
                        ${isSelected ? 'bg-[var(--accent-light)]' : ''}
                        ${!isSelectable && lockedStatus !== null ? 'opacity-50' : ''}
                      `}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          disabled={!isSelectable && !isSelected}
                          onCheckedChange={() => handleToggle(movement.id, movement.status)}
                          aria-label={`เลือก ${movement.docNumber}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/movements/${movement.id}`}
                          className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                        >
                          {movement.docNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={typeInfo.color}>
                          <TypeIcon className="w-3 h-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.icon}
                          <span className="ml-1">{statusInfo.shortLabel || statusInfo.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {movement.lines.length} รายการ
                        {movement.lines[0] && (
                          <span className="text-[var(--text-muted)] text-xs ml-2">
                            ({movement.lines[0].product.name}
                            {movement.lines[0].variant && (
                              <span className="text-[var(--accent-primary)]">
                                {' - '}{movement.lines[0].variant.name || movement.lines[0].variant.sku}
                              </span>
                            )}
                            {movement.lines.length > 1 && ` +${movement.lines.length - 1}`})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {movement.createdBy.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {formatDateTime(movement.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/movements/${movement.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedIds={selectedIds}
        selectedStatus={selectedStatus}
        canApprove={canApprove}
        onClear={handleClear}
        onSuccess={handleSuccess}
      />
    </>
  )
}
