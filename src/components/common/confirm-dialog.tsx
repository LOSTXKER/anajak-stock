/**
 * ConfirmDialog - Reusable confirmation dialog
 * 
 * @example
 * <ConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="ยืนยันการลบ"
 *   description="คุณต้องการลบรายการนี้หรือไม่?"
 *   onConfirm={handleDelete}
 *   variant="destructive"
 * />
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle, Info, CheckCircle } from 'lucide-react'

type DialogVariant = 'default' | 'destructive' | 'warning' | 'success'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  variant?: DialogVariant
  isLoading?: boolean
}

const variantConfig: Record<
  DialogVariant,
  { icon: typeof AlertTriangle; iconColor: string; buttonVariant: 'default' | 'destructive' }
> = {
  default: {
    icon: Info,
    iconColor: 'text-[var(--accent-primary)]',
    buttonVariant: 'default',
  },
  destructive: {
    icon: AlertTriangle,
    iconColor: 'text-[var(--status-error)]',
    buttonVariant: 'destructive',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-[var(--status-warning)]',
    buttonVariant: 'default',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-[var(--status-success)]',
    buttonVariant: 'default',
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  onConfirm,
  variant = 'default',
  isLoading: externalLoading,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = externalLoading ?? internalLoading

  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = async () => {
    try {
      setInternalLoading(true)
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error('Confirm action failed:', error)
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full ${
                variant === 'destructive'
                  ? 'bg-[var(--status-error-light)]'
                  : variant === 'warning'
                  ? 'bg-[var(--status-warning-light)]'
                  : variant === 'success'
                  ? 'bg-[var(--status-success-light)]'
                  : 'bg-[var(--accent-primary-light)]'
              }`}
            >
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description && (
            <DialogDescription className="pt-2">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Delete confirmation shortcut
interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName?: string
  onConfirm: () => void | Promise<void>
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName = 'รายการนี้',
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="ยืนยันการลบ"
      description={`คุณต้องการลบ${itemName}หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
      confirmLabel="ลบ"
      variant="destructive"
      onConfirm={onConfirm}
    />
  )
}
