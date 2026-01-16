'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startNavigation } from '@/components/navigation-progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2, Eye, Loader2 } from 'lucide-react'
import { deleteProduct } from '@/actions/products'
import { toast } from 'sonner'

interface ProductActionsProps {
  product: {
    id: string
    name: string
    sku: string
  }
}

export function ProductActions({ product }: ProductActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleNavigate(path: string) {
    startNavigation()
    startTransition(() => {
      router.push(path)
    })
  }

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteProduct(product.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('ลบสินค้าเรียบร้อยแล้ว')
      setDeleteDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => handleNavigate(`/products/${product.id}`)}
            className="cursor-pointer"
          >
            <Eye className="w-4 h-4 mr-2" />
            ดูรายละเอียด
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleNavigate(`/products/${product.id}/edit`)}
            className="cursor-pointer"
          >
            <Edit className="w-4 h-4 mr-2" />
            แก้ไข
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            variant="destructive"
            className="cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            ลบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบสินค้า</DialogTitle>
            <DialogDescription>
              คุณต้องการลบสินค้า &quot;{product.name}&quot; ({product.sku}) หรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบสินค้า
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
