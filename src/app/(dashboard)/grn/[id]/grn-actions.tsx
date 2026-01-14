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
import { postGRN } from '@/actions/po'
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
              ⚠️ ยังไม่รองรับการยกเลิก GRN กรุณาติดต่อผู้ดูแลระบบ
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
