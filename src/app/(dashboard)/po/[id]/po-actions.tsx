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
import { Send, Truck, Loader2, CheckCircle, XCircle, Edit } from 'lucide-react'
import { approvePO, sendPO, cancelPO } from '@/actions/po'
import { toast } from 'sonner'

interface POActionsProps {
  poId: string
  poStatus: string
  canApprove: boolean
  canEdit: boolean
}

export function POActions({ poId, poStatus: initialStatus, canApprove, canEdit }: POActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Optimistic status update - shows new status immediately while server processes
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(initialStatus)
  
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Use optimistic status for display
  const poStatus = optimisticStatus
  const isProcessing = isPending

  // Approve PO (DRAFT → APPROVED)
  async function handleApprove() {
    setApproveDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('APPROVED')
      const result = await approvePO(poId)
      if (result.success) {
        toast.success('อนุมัติใบสั่งซื้อเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Send PO to Supplier (APPROVED → SENT)
  async function handleSend() {
    setSendDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('SENT')
      const result = await sendPO(poId)
      if (result.success) {
        toast.success('ส่ง PO ให้ Supplier เรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Cancel PO
  async function handleCancel() {
    setCancelDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('CANCELLED')
      const result = await cancelPO(poId, cancelReason)
      if (result.success) {
        toast.success('ยกเลิก PO เรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* DRAFT: Edit + Approve */}
        {poStatus === 'DRAFT' && (
          <>
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/po/${poId}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  แก้ไข
                </Link>
              </Button>
            )}
            {canApprove && (
              <Button
                onClick={() => setApproveDialogOpen(true)}
                className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                อนุมัติ
              </Button>
            )}
          </>
        )}

        {/* APPROVED: Send to Supplier */}
        {poStatus === 'APPROVED' && (
          <Button
            onClick={() => setSendDialogOpen(true)}
            className="bg-[var(--status-info)] hover:bg-[var(--status-info)]/90 text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            ส่งให้ Supplier
          </Button>
        )}

        {/* SENT / IN_PROGRESS / PARTIALLY_RECEIVED: Receive Goods */}
        {['SENT', 'IN_PROGRESS', 'PARTIALLY_RECEIVED'].includes(poStatus) && (
          <Button asChild>
            <Link href={`/grn/new?poId=${poId}`}>
              <Truck className="w-4 h-4 mr-2" />
              รับสินค้า
            </Link>
          </Button>
        )}

        {/* Cancel button for non-closed/cancelled statuses */}
        {!['CLOSED', 'CANCELLED', 'FULLY_RECEIVED'].includes(poStatus) && (
          <Button
            variant="outline"
            onClick={() => setCancelDialogOpen(true)}
            className="border-[var(--status-error)]/30 text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
          >
            <XCircle className="w-4 h-4 mr-2" />
            ยกเลิก
          </Button>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              คุณต้องการอนุมัติใบสั่งซื้อนี้หรือไม่?
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

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ส่ง PO ให้ Supplier</DialogTitle>
            <DialogDescription>
              ยืนยันว่าคุณได้ส่ง PO นี้ให้ Supplier แล้ว (ทาง Email, Line, หรือช่องทางอื่น)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSend}
              disabled={isProcessing}
              className="bg-[var(--status-info)] hover:bg-[var(--status-info)]/90 text-white"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              ยืนยันส่งแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยกเลิกใบสั่งซื้อ</DialogTitle>
            <DialogDescription>
              คุณต้องการยกเลิก PO นี้หรือไม่?
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
                <XCircle className="w-4 h-4 mr-2" />
              )}
              ยกเลิก PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
