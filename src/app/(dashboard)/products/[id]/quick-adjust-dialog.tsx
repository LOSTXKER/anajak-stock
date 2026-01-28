'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { createMovement, submitMovement } from '@/actions/movements'
import { getLocations, getStockByProductVariantLocation } from '@/actions/stock'
import { MovementType } from '@/generated/prisma'
import type { LocationWithWarehouse } from '@/types'

interface StockLocation {
  locationId: string
  locationCode: string
  warehouseName: string
  qty: number
}

interface QuickAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: {
    id: string
    sku: string
    name: string | null
    productId: string
    productName: string
    options: Array<{ typeName: string; value: string }>
    stockByLocation: StockLocation[]
  }
}

export function QuickAdjustDialog({
  open,
  onOpenChange,
  variant,
}: QuickAdjustDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [locations, setLocations] = useState<LocationWithWarehouse[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [currentStock, setCurrentStock] = useState<number>(0)
  const [newQty, setNewQty] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [isLoadingStock, setIsLoadingStock] = useState(false)

  // Load locations on open
  useEffect(() => {
    if (open) {
      loadLocations()
      // Reset form
      setSelectedLocationId('')
      setCurrentStock(0)
      setNewQty(0)
      setReason('')
      setNote('')
    }
  }, [open])

  const loadLocations = async () => {
    const locs = await getLocations()
    setLocations(locs as LocationWithWarehouse[])
    
    // Auto-select first location if variant has stock there
    if (variant.stockByLocation.length > 0) {
      const firstWithStock = variant.stockByLocation[0]
      setSelectedLocationId(firstWithStock.locationId)
      setCurrentStock(firstWithStock.qty)
      setNewQty(firstWithStock.qty)
    }
  }

  // Load stock when location changes
  const handleLocationChange = useCallback(async (locationId: string) => {
    setSelectedLocationId(locationId)
    
    // Check if we have cached stock from variant data
    const cachedStock = variant.stockByLocation.find(s => s.locationId === locationId)
    if (cachedStock) {
      setCurrentStock(cachedStock.qty)
      setNewQty(cachedStock.qty)
      return
    }
    
    // Fetch from server
    setIsLoadingStock(true)
    try {
      const qty = await getStockByProductVariantLocation(
        variant.productId,
        variant.id,
        locationId
      )
      setCurrentStock(qty)
      setNewQty(qty)
    } catch (error) {
      console.error('Failed to load stock:', error)
      setCurrentStock(0)
      setNewQty(0)
    } finally {
      setIsLoadingStock(false)
    }
  }, [variant])

  const diff = newQty - currentStock

  const handleSubmit = async () => {
    if (!selectedLocationId) {
      toast.error('กรุณาเลือกโลเคชัน')
      return
    }

    if (diff === 0) {
      toast.error('ยอดไม่มีการเปลี่ยนแปลง')
      return
    }

    setIsLoading(true)

    try {
      const result = await createMovement({
        type: MovementType.ADJUST,
        note: note || `ปรับยอด ${variant.sku} ที่ ${locations.find(l => l.id === selectedLocationId)?.code}`,
        reason: reason || 'ปรับยอดด่วน',
        lines: [{
          productId: variant.productId,
          variantId: variant.id,
          toLocationId: selectedLocationId,
          qty: diff, // Backend expects +/- qty
          unitCost: 0,
        }],
      })

      if (result.success) {
        // Auto-submit and post
        await submitMovement(result.data.id)
        toast.success(`ปรับยอดสำเร็จ: ${currentStock} → ${newQty} (${diff > 0 ? '+' : ''}${diff})`)
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to adjust stock:', error)
      toast.error('เกิดข้อผิดพลาดในการปรับยอด')
    } finally {
      setIsLoading(false)
    }
  }

  const variantLabel = variant.options.length > 0
    ? variant.options.map(o => o.value).join(' / ')
    : variant.name || variant.sku

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[var(--status-warning)]" />
            ปรับยอดสต๊อค
          </DialogTitle>
          <DialogDescription>
            ปรับยอดสต๊อคสำหรับ <span className="font-medium">{variant.productName}</span>
            {variant.options.length > 0 && (
              <span className="ml-1">
                - <span className="text-[var(--accent-primary)]">{variantLabel}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Variant Info */}
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">{variant.sku}</Badge>
              {variant.options.map((opt, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {opt.typeName}: {opt.value}
                </Badge>
              ))}
            </div>
          </div>

          {/* Location Select */}
          <div className="space-y-2">
            <Label>โลเคชัน</Label>
            <Select
              value={selectedLocationId}
              onValueChange={handleLocationChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกโลเคชัน" />
              </SelectTrigger>
              <SelectContent>
                {/* Show locations with stock first */}
                {variant.stockByLocation.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-[var(--text-muted)]">มีสต๊อค</div>
                    {variant.stockByLocation.map((stock) => (
                      <SelectItem key={stock.locationId} value={stock.locationId}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{stock.warehouseName} - {stock.locationCode}</span>
                          <Badge variant="outline" className="ml-2">
                            {stock.qty.toLocaleString()}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                    <div className="border-t border-[var(--border-default)] my-1" />
                  </>
                )}
                {/* Show other locations without stock */}
                {locations.filter(loc => !variant.stockByLocation.some(s => s.locationId === loc.id)).length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-[var(--text-muted)]">โลเคชันอื่น</div>
                    {locations
                      .filter(loc => !variant.stockByLocation.some(s => s.locationId === loc.id))
                      .map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.warehouse.name} - {loc.code}
                        </SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Adjustment */}
          {selectedLocationId && (
            <div className="space-y-4">
              {/* Current Stock Display */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <span className="text-sm text-[var(--text-muted)]">สต๊อคปัจจุบัน</span>
                {isLoadingStock ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="font-mono font-bold text-lg">{currentStock.toLocaleString()}</span>
                )}
              </div>

              {/* New Qty Input */}
              <div className="space-y-2">
                <Label>ยอดใหม่</Label>
                <Input
                  type="number"
                  min="0"
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  className="text-lg font-mono"
                  disabled={isLoadingStock}
                />
              </div>

              {/* Diff Preview */}
              <div className="flex items-center justify-center gap-3 p-4 rounded-lg border border-[var(--border-default)]">
                <div className="text-center">
                  <div className="text-xs text-[var(--text-muted)]">เดิม</div>
                  <div className="font-mono font-bold">{currentStock}</div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--text-muted)]" />
                <div className="text-center">
                  <div className="text-xs text-[var(--text-muted)]">ใหม่</div>
                  <div className="font-mono font-bold">{newQty}</div>
                </div>
                <div className="text-center ml-4">
                  <div className="text-xs text-[var(--text-muted)]">ผลต่าง</div>
                  <Badge
                    variant="outline"
                    className={
                      diff > 0
                        ? 'bg-[var(--status-success-light)] text-[var(--status-success)] font-mono'
                        : diff < 0
                        ? 'bg-[var(--status-error-light)] text-[var(--status-error)] font-mono'
                        : 'font-mono'
                    }
                  >
                    {diff > 0 ? '+' : ''}{diff}
                  </Badge>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>เหตุผล</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น ตรวจนับ, ของหาย, ของเสีย..."
                />
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label>หมายเหตุ (ถ้ามี)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedLocationId || diff === 0 || isLoadingStock}
            className="bg-[var(--status-warning)] hover:bg-[var(--status-warning-dark)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังปรับยอด...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                ปรับยอด
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
