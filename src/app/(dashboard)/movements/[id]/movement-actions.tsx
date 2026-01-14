'use client'

import { useState } from 'react'
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
import { Loader2, CheckCircle, XCircle, Send, PackageCheck, FileEdit, Ban } from 'lucide-react'
import { submitMovement, approveMovement, rejectMovement, postMovement } from '@/actions/movements'
import { toast } from 'sonner'

interface MovementActionsProps {
  movementId: string
  status: string
  canApprove: boolean
  canEdit: boolean
}

export function MovementActions({ movementId, status, canApprove, canEdit }: MovementActionsProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Dialogs
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  
  const [rejectReason, setRejectReason] = useState('')

  // Submit for approval (DRAFT → SUBMITTED)
  async function handleSubmit() {
    setIsProcessing(true)
    const result = await submitMovement(movementId)
    setIsProcessing(false)

    if (result.success) {
      toast.success('ส่งขออนุมัติเรียบร้อย')
      setSubmitDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  // Approve (SUBMITTED → APPROVED)
  async function handleApprove() {
    setIsProcessing(true)
    const result = await approveMovement(movementId)
    setIsProcessing(false)

    if (result.success) {
      toast.success('อนุมัติเรียบร้อย')
      setApproveDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  // Reject (SUBMITTED → REJECTED)
  async function handleReject() {
    setIsProcessing(true)
    const result = await rejectMovement(movementId, rejectReason)
    setIsProcessing(false)

    if (result.success) {
      toast.success('ปฏิเสธรายการเรียบร้อย')
      setRejectDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  // Post to stock (APPROVED → POSTED)
  async function handlePost() {
    setIsProcessing(true)
    const result = await postMovement(movementId)
    setIsProcessing(false)

    if (result.success) {
      toast.success('บันทึกเข้าสต๊อคเรียบร้อย')
      setPostDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* DRAFT: Submit for Approval */}
        {status === 'DRAFT' && (
          <>
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => router.push(`/movements/${movementId}/edit`)}
              >
                <FileEdit className="w-4 h-4 mr-2" />
                แก้ไข
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
              ⚠️ ยังไม่รองรับการยกเลิกรายการ กรุณาติดต่อผู้ดูแลระบบ
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
