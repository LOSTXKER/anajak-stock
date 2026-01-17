'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { Loader2, CheckCircle, XCircle, Send, PackageCheck, FileEdit, Ban, RotateCcw, CornerDownRight } from 'lucide-react'
import { submitMovement, approveMovement, rejectMovement, postMovement, cancelMovement, reverseMovement } from '@/actions/movements'
import { toast } from 'sonner'

interface MovementActionsProps {
  movementId: string
  status: string
  type: string
  canApprove: boolean
  canEdit: boolean
}

export function MovementActions({ movementId, status: initialStatus, type, canApprove, canEdit }: MovementActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Optimistic status update - shows new status immediately while server processes
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(initialStatus)
  
  // Dialogs
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  
  const [rejectReason, setRejectReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  // Use optimistic status for display
  const status = optimisticStatus

  // Submit for approval (DRAFT → SUBMITTED)
  async function handleSubmit() {
    setSubmitDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('SUBMITTED')
      const result = await submitMovement(movementId)
      if (result.success) {
        toast.success('ส่งขออนุมัติเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Approve (SUBMITTED → APPROVED)
  async function handleApprove() {
    setApproveDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('APPROVED')
      const result = await approveMovement(movementId)
      if (result.success) {
        toast.success('อนุมัติเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Reject (SUBMITTED → REJECTED)
  async function handleReject() {
    setRejectDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('REJECTED')
      const result = await rejectMovement(movementId, rejectReason)
      if (result.success) {
        toast.success('ปฏิเสธรายการเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Post to stock (APPROVED → POSTED)
  async function handlePost() {
    setPostDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('POSTED')
      const result = await postMovement(movementId)
      if (result.success) {
        toast.success('บันทึกเข้าสต๊อคเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Cancel movement
  async function handleCancel() {
    setCancelDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('CANCELLED')
      const result = await cancelMovement(movementId, cancelReason)
      if (result.success) {
        toast.success('ยกเลิกรายการเรียบร้อย')
        router.push('/movements')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Reverse movement (create opposite entry)
  async function handleReverse() {
    setReverseDialogOpen(false)
    startTransition(async () => {
      const result = await reverseMovement(movementId)
      if (result.success) {
        toast.success('สร้างรายการกลับรายการเรียบร้อย')
        router.push(`/movements/${result.data.id}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  // Create return from issue - navigate to return form
  function handleReturn() {
    setReturnDialogOpen(false)
    // Navigate to new movement page with return type and reference
    router.push(`/movements/new?type=RETURN&refId=${movementId}`)
  }

  // Common processing state
  const isProcessing = isPending

  return (
    <>
      <div className="flex items-center gap-2">
        {/* DRAFT: Submit for Approval */}
        {status === 'DRAFT' && (
          <>
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/movements/${movementId}/edit`}>
                  <FileEdit className="w-4 h-4 mr-2" />
                  แก้ไข
                </Link>
              </Button>
            )}
            <Button
              onClick={() => setSubmitDialogOpen(true)}
              className="bg-[var(--status-info)] hover:bg-[var(--status-info)]/90 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              ส่งขออนุมัติ
            </Button>
          </>
        )}

        {/* SUBMITTED: Approve or Reject */}
        {status === 'SUBMITTED' && canApprove && (
          <>
            <Button
              onClick={() => setApproveDialogOpen(true)}
              className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              อนุมัติ
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(true)}
              className="border-[var(--status-error)]/30 text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
            >
              <XCircle className="w-4 h-4 mr-2" />
              ปฏิเสธ
            </Button>
          </>
        )}

        {/* APPROVED: Post to Stock */}
        {status === 'APPROVED' && (
          <Button
            onClick={() => setPostDialogOpen(true)}
            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
          >
            <PackageCheck className="w-4 h-4 mr-2" />
            บันทึกเข้าสต๊อค
          </Button>
        )}

        {/* POSTED: Reverse option */}
        {status === 'POSTED' && (
          <Button
            variant="outline"
            onClick={() => setReverseDialogOpen(true)}
            className="border-[var(--status-warning)]/30 text-[var(--status-warning)] hover:bg-[var(--status-warning)]/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            กลับรายการ
          </Button>
        )}

        {/* POSTED ISSUE: Return option */}
        {status === 'POSTED' && type === 'ISSUE' && (
          <Button
            variant="outline"
            onClick={() => setReturnDialogOpen(true)}
            className="border-[var(--accent-primary)]/30 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
          >
            <CornerDownRight className="w-4 h-4 mr-2" />
            คืนของ
          </Button>
        )}

        {/* Cancel for non-final statuses */}
        {!['POSTED', 'CANCELLED', 'REJECTED'].includes(status) && (
          <Button
            variant="ghost"
            onClick={() => setCancelDialogOpen(true)}
            className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
          >
            <Ban className="w-4 h-4 mr-2" />
            ยกเลิก
          </Button>
        )}
      </div>

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ส่งขออนุมัติ</DialogTitle>
            <DialogDescription>
              คุณต้องการส่งรายการเคลื่อนไหวนี้เพื่อขออนุมัติหรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="bg-[var(--status-info)] hover:bg-[var(--status-info)]/90 text-white"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              ส่งขออนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              คุณต้องการอนุมัติรายการเคลื่อนไหวนี้หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              อนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ปฏิเสธรายการ</DialogTitle>
            <DialogDescription>
              กรุณาระบุเหตุผลในการปฏิเสธ
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
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              ปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>บันทึกเข้าสต๊อค</DialogTitle>
            <DialogDescription>
              ยืนยันการบันทึกรายการนี้เข้าสต๊อค? การกระทำนี้จะอัปเดตจำนวนสินค้าในคลัง
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handlePost}
              disabled={isProcessing}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4 mr-2" />
              )}
              บันทึกเข้าสต๊อค
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยกเลิกรายการ</DialogTitle>
            <DialogDescription>
              ยืนยันการยกเลิกรายการเคลื่อนไหวนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
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
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              ปิด
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              ยกเลิกรายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Dialog */}
      <Dialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>กลับรายการ (Reversal)</DialogTitle>
            <DialogDescription>
              ระบบจะสร้างรายการใหม่ที่มีผลตรงข้ามกับรายการนี้ เพื่อกลับคืนสต๊อคให้เป็นเหมือนก่อนทำรายการนี้
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-[var(--status-warning-light)] border border-[var(--status-warning)]/30 rounded-lg p-4">
              <p className="text-sm text-[var(--status-warning)]">
                <strong>หมายเหตุ:</strong> รายการกลับรายการที่สร้างใหม่จะอยู่ในสถานะ Draft 
                และต้องผ่านขั้นตอนอนุมัติและ Post เหมือนรายการปกติ
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleReverse}
              disabled={isProcessing}
              className="bg-[var(--status-warning)] hover:bg-[var(--status-warning)]/90 text-white"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              สร้างรายการกลับรายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>คืนของจากการเบิก</DialogTitle>
            <DialogDescription>
              สร้างรายการคืนสินค้ากลับเข้าสต๊อคจากการเบิกนี้
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-[var(--accent-light)] border border-[var(--accent-primary)]/30 rounded-lg p-4">
              <p className="text-sm text-[var(--accent-primary)]">
                ระบบจะนำท่านไปหน้าสร้างรายการคืนของ โดยจะ pre-fill ข้อมูลจากรายการเบิกนี้
                ท่านสามารถแก้ไขจำนวนที่คืนได้
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleReturn}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
            >
              <CornerDownRight className="w-4 h-4 mr-2" />
              ไปหน้าคืนของ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
