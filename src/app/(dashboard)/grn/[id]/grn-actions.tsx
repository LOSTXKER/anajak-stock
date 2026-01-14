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
import { Loader2, PackageCheck, Ban } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { postGRN, cancelGRN } from '@/actions/po'
import { toast } from 'sonner'

interface GRNActionsProps {
  grnId: string
  status: string
  canPost: boolean
}

export function GRNActions({ grnId, status, canPost }: GRNActionsProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Post GRN to stock (DRAFT → POSTED)
  async function handlePost() {
    setIsProcessing(true)
    const result = await postGRN(grnId)
    setIsProcessing(false)

    if (result.success) {
      toast.success('บันทึกเข้าสต๊อคเรียบร้อย')
      setPostDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  // Cancel GRN
  async function handleCancel() {
    setIsProcessing(true)
    const result = await cancelGRN(grnId, cancelReason)
    setIsProcessing(false)

    if (result.success) {
      toast.success('ยกเลิก GRN เรียบร้อย')
      setCancelDialogOpen(false)
      router.push('/grn')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* DRAFT: Post to Stock */}
        {status === 'DRAFT' && canPost && (
          <Button
            onClick={() => setPostDialogOpen(true)}
            className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
          >
            <PackageCheck className="w-4 h-4 mr-2" />
            บันทึกเข้าสต๊อค
          </Button>
        )}

        {/* Cancel for DRAFT only */}
        {status === 'DRAFT' && (
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

      {/* Post Dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>บันทึกเข้าสต๊อค</DialogTitle>
            <DialogDescription>
              ยืนยันการบันทึกรายการนี้เข้าสต๊อค? การกระทำนี้จะเพิ่มจำนวนสินค้าในคลังตามรายการที่รับ
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handlePost}
              disabled={isProcessing}
              className="bg-[var(--status-success)] hover:bg-[var(--status-success)]/90 text-white"
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
            <DialogTitle>ยกเลิก GRN</DialogTitle>
            <DialogDescription>
              ยืนยันการยกเลิก GRN นี้? การกระทำนี้ไม่สามารถย้อนกลับได้
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
              ยกเลิก GRN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
