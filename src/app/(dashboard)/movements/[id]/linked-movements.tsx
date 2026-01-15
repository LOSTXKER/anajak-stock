'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, RotateCcw, CornerDownRight, Link2 } from 'lucide-react'
import { getLinkedMovements } from '@/actions/movements'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface LinkedMovement {
  id: string
  docNumber: string
  type: string
  status: string
  refType?: string
  createdAt: Date
}

interface LinkedMovementsProps {
  movementId: string
}

const typeLabels: Record<string, string> = {
  RECEIVE: 'รับเข้า',
  ISSUE: 'เบิกออก',
  TRANSFER: 'โอนย้าย',
  ADJUST: 'ปรับยอด',
  RETURN: 'คืนของ',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
  SUBMITTED: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
  APPROVED: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
  REJECTED: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
  POSTED: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
  CANCELLED: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'ร่าง',
  SUBMITTED: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
  POSTED: 'บันทึกแล้ว',
  CANCELLED: 'ยกเลิก',
}

export function LinkedMovements({ movementId }: LinkedMovementsProps) {
  const [linkedMovements, setLinkedMovements] = useState<LinkedMovement[]>([])
  const [originalMovement, setOriginalMovement] = useState<LinkedMovement | null>(null)
  const [refType, setRefType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadLinkedMovements() {
      try {
        const result = await getLinkedMovements(movementId)
        if (result.success && result.data) {
          setLinkedMovements(result.data.linkedMovements)
          setOriginalMovement(result.data.originalMovement)
          setRefType(result.data.refType || null)
        }
      } catch (error) {
        console.error('Failed to load linked movements:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadLinkedMovements()
  }, [movementId])

  if (isLoading) {
    return null
  }

  const hasLinks = linkedMovements.length > 0 || originalMovement

  if (!hasLinks) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[var(--accent-primary)]" />
          รายการที่เชื่อมโยง
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Original Movement (if this is a return/reversal) */}
        {originalMovement && (
          <div className="border border-[var(--border-default)] rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
              <ArrowRight className="w-4 h-4" />
              {refType === 'RETURN_FROM' ? 'คืนจากเอกสาร' : 'กลับรายการจาก'}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href={`/movements/${originalMovement.id}`}
                  className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                >
                  {originalMovement.docNumber}
                </Link>
                <Badge variant="secondary" className="text-xs">
                  {typeLabels[originalMovement.type] || originalMovement.type}
                </Badge>
                <Badge variant="secondary" className={`text-xs ${statusColors[originalMovement.status] || ''}`}>
                  {statusLabels[originalMovement.status] || originalMovement.status}
                </Badge>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {format(new Date(originalMovement.createdAt), 'd MMM yy', { locale: th })}
              </span>
            </div>
          </div>
        )}

        {/* Linked Movements (returns, reversals from this document) */}
        {linkedMovements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              {linkedMovements[0].refType === 'RETURN_FROM' ? (
                <>
                  <CornerDownRight className="w-4 h-4" />
                  รายการคืนของ
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  รายการกลับรายการ
                </>
              )}
            </div>
            {linkedMovements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-center justify-between border border-[var(--border-default)] rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <Link
                    href={`/movements/${movement.id}`}
                    className="font-mono text-sm text-[var(--accent-primary)] hover:underline"
                  >
                    {movement.docNumber}
                  </Link>
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[movement.type] || movement.type}
                  </Badge>
                  <Badge variant="secondary" className={`text-xs ${statusColors[movement.status] || ''}`}>
                    {statusLabels[movement.status] || movement.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">
                    {format(new Date(movement.createdAt), 'd MMM yy', { locale: th })}
                  </span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/movements/${movement.id}`}>
                      ดู
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
