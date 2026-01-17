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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Send, ShoppingCart, Loader2, CheckCircle, XCircle, Edit } from 'lucide-react'
import { submitPR, approvePR, rejectPR } from '@/actions/pr'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'

interface Supplier {
  id: string
  name: string
}

interface PRActionsProps {
  prId: string
  prStatus: string
  canApprove: boolean
  canEdit: boolean
  suppliers: Supplier[]
}

export function PRActions({ prId, prStatus: initialStatus, canApprove, canEdit, suppliers }: PRActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Optimistic status update - shows new status immediately while server processes
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(initialStatus)
  
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Use optimistic status for display
  const prStatus = optimisticStatus
  const isSubmitting = isPending

  // Submit PR (DRAFT → SUBMITTED)
  async function handleSubmit() {
    startTransition(async () => {
      setOptimisticStatus('SUBMITTED')
      const result = await submitPR(prId)
      if (result.success) {
        toast.success('ส่งใบขอซื้อเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Approve PR
  async function handleApprove() {
    setApproveDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('APPROVED')
      const result = await approvePR(prId)
      if (result.success) {
        toast.success('อนุมัติใบขอซื้อเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Reject PR
  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการปฏิเสธ')
      return
    }

    setRejectDialogOpen(false)
    startTransition(async () => {
      setOptimisticStatus('REJECTED')
      const result = await rejectPR(prId, rejectReason)
      if (result.success) {
        toast.success('ปฏิเสธใบขอซื้อเรียบร้อย')
      } else {
        setOptimisticStatus(initialStatus) // rollback
        toast.error(result.error)
      }
    })
  }

  // Convert to PO - redirect to PO creation page with PR data
  function handleConvertToPO() {
    if (!selectedSupplier) {
      toast.error('กรุณาเลือก Supplier')
      return
    }
    router.push(`/po/new?prId=${prId}&supplierId=${selectedSupplier}`)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* DRAFT: Edit + Submit */}
        {prStatus === 'DRAFT' && (
          <>
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/pr/${prId}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  แก้ไข
                </Link>
              </Button>
            )}
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[var(--status-info)] hover:bg-[var(--status-info)]/90 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              ส่งอนุมัติ
            </Button>
          </>
        )}

        {/* SUBMITTED: Approve + Reject (for approvers) */}
        {prStatus === 'SUBMITTED' && canApprove && (
          <>
            <Button
              onClick={() => setRejectDialogOpen(true)}
              variant="outline"
              className="border-[var(--status-error)]/30 text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
            >
              <XCircle className="w-4 h-4 mr-2" />
              ปฏิเสธ
            </Button>
            <Button
              onClick={() => setApproveDialogOpen(true)}
              className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              อนุมัติ
            </Button>
          </>
        )}

        {/* APPROVED: Convert to PO */}
        {prStatus === 'APPROVED' && (
          <Button
            onClick={() => setConvertDialogOpen(true)}
            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            แปลงเป็น PO
          </Button>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              คุณต้องการอนุมัติใบขอซื้อนี้หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
            >
              {isSubmitting ? (
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
            <DialogTitle>ปฏิเสธใบขอซื้อ</DialogTitle>
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
              disabled={isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              ปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to PO Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>แปลงเป็นใบสั่งซื้อ (PO)</DialogTitle>
            <DialogDescription>
              เลือก Supplier เพื่อสร้างใบสั่งซื้อจาก PR นี้
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleConvertToPO}
              disabled={!selectedSupplier}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              สร้าง PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
