'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  X,
  PackageCheck,
  Ban,
  AlertCircle,
} from 'lucide-react'
import { DocStatus } from '@/generated/prisma'
import { 
  batchApproveMovements, 
  batchRejectMovements, 
  batchPostMovements, 
  batchCancelMovements 
} from '@/actions/movements'
import { toast } from 'sonner'
import type { BatchResult } from '@/types'

interface BatchActionBarProps {
  selectedIds: string[]
  selectedStatus: DocStatus | null
  canApprove: boolean
  onClear: () => void
  onSuccess: () => void
}

type ActionType = 'approve' | 'reject' | 'post' | 'cancel'

export function BatchActionBar({ 
  selectedIds, 
  selectedStatus,
  canApprove,
  onClear, 
  onSuccess,
}: BatchActionBarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Dialog states
  const [activeAction, setActiveAction] = useState<ActionType | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  
  // Result dialog
  const [showResult, setShowResult] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)

  const selectedCount = selectedIds.length

  if (selectedCount === 0) return null

  // Determine available actions based on selected status
  const canShowApprove = selectedStatus === DocStatus.SUBMITTED && canApprove
  const canShowReject = selectedStatus === DocStatus.SUBMITTED && canApprove
  const canShowPost = selectedStatus === DocStatus.APPROVED
  const canShowCancel = selectedStatus === DocStatus.DRAFT || 
                        selectedStatus === DocStatus.SUBMITTED || 
                        selectedStatus === DocStatus.APPROVED

  async function handleAction(action: ActionType) {
    setActiveAction(null)
    
    startTransition(async () => {
      let result: { success: boolean; data?: BatchResult; error?: string }
      
      switch (action) {
        case 'approve':
          result = await batchApproveMovements(selectedIds)
          break
        case 'reject':
          result = await batchRejectMovements(selectedIds, rejectReason || undefined)
          setRejectReason('')
          break
        case 'post':
          result = await batchPostMovements(selectedIds)
          break
        case 'cancel':
          result = await batchCancelMovements(selectedIds, cancelReason || undefined)
          setCancelReason('')
          break
      }
      
      if (result.success && result.data) {
        const { succeeded, failed, total } = result.data
        
        if (failed === 0) {
          toast.success(`ดำเนินการสำเร็จ ${succeeded} รายการ`)
          onClear()
          onSuccess()
        } else if (succeeded === 0) {
          toast.error(`ดำเนินการไม่สำเร็จทั้ง ${total} รายการ`)
          setBatchResult(result.data)
          setShowResult(true)
        } else {
          toast.warning(`สำเร็จ ${succeeded} รายการ, ไม่สำเร็จ ${failed} รายการ`)
          setBatchResult(result.data)
          setShowResult(true)
          onSuccess()
        }
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด')
      }
    })
  }

  function closeResultDialog() {
    setShowResult(false)
    setBatchResult(null)
    onClear()
    router.refresh()
  }

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
          {/* Selected Count */}
          <div className="flex items-center gap-2 pr-4 border-r border-[var(--border-default)]">
            <span className="text-sm text-[var(--text-secondary)]">
              เลือก <span className="font-semibold text-[var(--accent-primary)]">{selectedCount}</span> รายการ
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canShowApprove && (
              <Button
                size="sm"
                onClick={() => setActiveAction('approve')}
                disabled={isPending}
                className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                อนุมัติทั้งหมด
              </Button>
            )}
            
            {canShowReject && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveAction('reject')}
                disabled={isPending}
                className="border-[var(--status-error)]/30 text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                ปฏิเสธทั้งหมด
              </Button>
            )}
            
            {canShowPost && (
              <Button
                size="sm"
                onClick={() => setActiveAction('post')}
                disabled={isPending}
                className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-2" />}
                Post ทั้งหมด
              </Button>
            )}
            
            {canShowCancel && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveAction('cancel')}
                disabled={isPending}
                className="text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                ยกเลิกทั้งหมด
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {/* Approve Dialog */}
      <Dialog open={activeAction === 'approve'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              คุณต้องการอนุมัติ {selectedCount} รายการที่เลือกหรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleAction('approve')}
              disabled={isPending}
              className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              อนุมัติ {selectedCount} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={activeAction === 'reject'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ปฏิเสธรายการ</DialogTitle>
            <DialogDescription>
              กรุณาระบุเหตุผลในการปฏิเสธ {selectedCount} รายการ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เหตุผล</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผลในการปฏิเสธ..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleAction('reject')}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              ปฏิเสธ {selectedCount} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Dialog */}
      <Dialog open={activeAction === 'post'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>บันทึกเข้าสต๊อค</DialogTitle>
            <DialogDescription>
              ยืนยันการ Post {selectedCount} รายการเข้าสต๊อค? การกระทำนี้จะอัปเดตจำนวนสินค้าในคลัง
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-[var(--status-warning-light)] border border-[var(--status-warning)]/30 rounded-lg p-4">
              <p className="text-sm text-[var(--status-warning)]">
                <strong>หมายเหตุ:</strong> การ Post หลายรายการพร้อมกันอาจใช้เวลาสักครู่
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleAction('post')}
              disabled={isPending}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-2" />}
              Post {selectedCount} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={activeAction === 'cancel'} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยกเลิกรายการ</DialogTitle>
            <DialogDescription>
              ยืนยันการยกเลิก {selectedCount} รายการ? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เหตุผล (ไม่บังคับ)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="ระบุเหตุผลในการยกเลิก..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              ปิด
            </Button>
            <Button
              onClick={() => handleAction('cancel')}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
              ยกเลิก {selectedCount} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={(open) => !open && closeResultDialog()}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--status-warning)]" />
              ผลการดำเนินการ
            </DialogTitle>
            {batchResult && (
              <DialogDescription>
                สำเร็จ {batchResult.succeeded} รายการ, ไม่สำเร็จ {batchResult.failed} รายการ
              </DialogDescription>
            )}
          </DialogHeader>
          
          {batchResult && (
            <div className="max-h-[300px] overflow-y-auto py-4">
              <div className="space-y-2">
                {batchResult.results.map((result) => (
                  <div 
                    key={result.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.success 
                        ? 'bg-[var(--status-success-light)]' 
                        : 'bg-[var(--status-error-light)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-[var(--status-success)]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[var(--status-error)]" />
                      )}
                      <span className="font-mono text-sm">{result.docNumber}</span>
                    </div>
                    {!result.success && result.error && (
                      <span className="text-xs text-[var(--status-error)]">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={closeResultDialog}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
