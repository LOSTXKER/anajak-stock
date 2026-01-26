'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Plus, Layers, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { addVariant } from '@/actions/variants'

interface ProductOptionGroup {
  name: string
  values: string[]
}

interface ExistingVariantOption {
  typeName: string
  value: string
}

interface AddVariantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  productSku: string
  productName: string
  existingVariants: { 
    id: string
    sku: string
    options: ExistingVariantOption[]
  }[]
  productOptionGroups: ProductOptionGroup[]
}

export function AddVariantDialog({
  open,
  onOpenChange,
  productId,
  productSku,
  productName,
  existingVariants,
  productOptionGroups,
}: AddVariantDialogProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  
  // Selected values for each option group (by group name)
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({})
  
  // Form data
  const [sku, setSku] = useState('')
  const [costPrice, setCostPrice] = useState(0)
  const [sellingPrice, setSellingPrice] = useState(0)
  const [barcode, setBarcode] = useState('')
  const [lowStockAlert, setLowStockAlert] = useState(true)

  // Get existing combinations to prevent duplicates
  const existingCombinations = useMemo(() => {
    return new Set(
      existingVariants.map(v => 
        v.options.map(o => `${o.typeName}:${o.value}`).sort().join('|')
      )
    )
  }, [existingVariants])

  // Check if current selection already exists
  const isDuplicate = useMemo(() => {
    if (Object.keys(selectedValues).length !== productOptionGroups.length) return false
    
    const currentCombination = productOptionGroups
      .map(og => `${og.name}:${selectedValues[og.name]}`)
      .sort()
      .join('|')
    
    return existingCombinations.has(currentCombination)
  }, [selectedValues, productOptionGroups, existingCombinations])

  // Auto-generate SKU when options change
  useEffect(() => {
    if (Object.keys(selectedValues).length === productOptionGroups.length) {
      const suffix = productOptionGroups
        .map(og => selectedValues[og.name])
        .join('-')
      setSku(`${productSku}-${suffix}`)
    } else {
      setSku('')
    }
  }, [selectedValues, productOptionGroups, productSku])

  // Toggle option value selection
  const toggleValue = (groupName: string, value: string) => {
    setSelectedValues(prev => {
      if (prev[groupName] === value) {
        const { [groupName]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [groupName]: value }
    })
  }

  // Reset form
  const resetForm = () => {
    setSelectedValues({})
    setSku('')
    setCostPrice(0)
    setSellingPrice(0)
    setBarcode('')
    setLowStockAlert(true)
  }

  // Handle save
  const handleSave = async () => {
    if (!sku) {
      toast.error('กรุณาเลือกตัวเลือกให้ครบ')
      return
    }

    if (isDuplicate) {
      toast.error('ตัวเลือกนี้มีอยู่แล้ว')
      return
    }

    setIsSaving(true)

    try {
      // Build options array for the new variant
      // We need to find or create OptionType/OptionValue IDs
      const optionValueIds: string[] = []
      
      for (const group of productOptionGroups) {
        const selectedValue = selectedValues[group.name]
        if (!selectedValue) continue
        
        // Create option value via API (will also create OptionType if needed)
        const response = await fetch('/api/options/values', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optionTypeName: group.name,
            value: selectedValue,
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          optionValueIds.push(data.id)
        } else {
          toast.error(`ไม่สามารถสร้างตัวเลือก "${selectedValue}" ได้`)
          setIsSaving(false)
          return
        }
      }

      // Create the variant
      const result = await addVariant(productId, {
        sku,
        barcode: barcode || undefined,
        name: Object.values(selectedValues).join(', '),
        stockType: 'STOCKED',
        costPrice,
        sellingPrice,
        reorderPoint: 0,
        minQty: 0,
        maxQty: 0,
        lowStockAlert,
        optionValueIds,
      })

      if (result.success) {
        toast.success('เพิ่มตัวเลือกสำเร็จ')
        resetForm()
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsSaving(false)
    }
  }

  const hasNoOptionGroups = productOptionGroups.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
            เพิ่มตัวเลือกใหม่
          </DialogTitle>
          <DialogDescription>
            เพิ่มตัวเลือก (สี/ไซส์) ใหม่ให้กับ <span className="font-medium">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        {hasNoOptionGroups ? (
          <div className="py-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[var(--status-warning)]" />
            <p className="text-lg font-medium mb-2">ยังไม่ได้กำหนดตัวเลือกสินค้า</p>
            <p className="text-[var(--text-muted)]">
              กรุณากำหนดตัวเลือก (สี, ไซส์) ที่ส่วน &quot;ตัวเลือกสินค้า&quot; ก่อน
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Option Group Selectors */}
            {productOptionGroups.map((group) => (
              <div key={group.name} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">{group.name}</Label>
                  {selectedValues[group.name] && (
                    <Badge className="bg-[var(--accent-primary)]">
                      เลือก: {selectedValues[group.name]}
                    </Badge>
                  )}
                </div>
                
                {/* Values as chips */}
                <div className="flex flex-wrap gap-2">
                  {group.values.map((value) => {
                    const isSelected = selectedValues[group.name] === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleValue(group.name, value)}
                        className={`
                          px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium
                          ${isSelected 
                            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' 
                            : 'bg-[var(--bg-primary)] border-[var(--border-default)] hover:border-[var(--accent-primary)]'
                          }
                        `}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Divider */}
            <div className="border-t border-[var(--border-default)] my-4" />

            {/* SKU Preview */}
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="เลือกตัวเลือกเพื่อสร้าง SKU"
                className={isDuplicate ? 'border-[var(--status-error)]' : ''}
              />
              {isDuplicate && (
                <p className="text-sm text-[var(--status-error)]">
                  ⚠️ ตัวเลือกนี้มีอยู่แล้ว
                </p>
              )}
            </div>

            {/* Price inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ราคาทุน</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">฿</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ราคาขาย</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">฿</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellingPrice || ''}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Barcode */}
            <div className="space-y-2">
              <Label>Barcode (ถ้ามี)</Label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="รหัสบาร์โค้ด"
              />
            </div>

            {/* Low stock alert */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="lowStockAlert"
                checked={lowStockAlert}
                onCheckedChange={(checked) => setLowStockAlert(!!checked)}
              />
              <Label htmlFor="lowStockAlert" className="font-normal cursor-pointer">
                แจ้งเตือนเมื่อสต๊อคต่ำ
              </Label>
            </div>

            {/* Preview */}
            {Object.keys(selectedValues).length > 0 && (
              <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <p className="text-sm font-medium mb-2">ตัวเลือกที่จะสร้าง:</p>
                <div className="flex flex-wrap gap-2">
                  {productOptionGroups.map(og => (
                    selectedValues[og.name] && (
                      <Badge key={og.name} variant="secondary">
                        {og.name}: {selectedValues[og.name]}
                      </Badge>
                    )
                  ))}
                </div>
                {sku && !isDuplicate && (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    SKU: <span className="font-mono">{sku}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          {!hasNoOptionGroups && (
            <Button
              onClick={handleSave}
              disabled={isSaving || !sku || isDuplicate || Object.keys(selectedValues).length !== productOptionGroups.length}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มตัวเลือก
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
