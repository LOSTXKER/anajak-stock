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
import { Loader2, Plus, Layers, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { addVariant } from '@/actions/variants'
import { getOptionTypesWithValues } from '@/actions/variants'

interface OptionType {
  id: string
  name: string
  values: { id: string; value: string }[]
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
}

export function AddVariantDialog({
  open,
  onOpenChange,
  productId,
  productSku,
  productName,
  existingVariants,
}: AddVariantDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [optionTypes, setOptionTypes] = useState<OptionType[]>([])
  
  // Selected values for each option type
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({})
  
  // Form data
  const [sku, setSku] = useState('')
  const [costPrice, setCostPrice] = useState(0)
  const [sellingPrice, setSellingPrice] = useState(0)
  const [barcode, setBarcode] = useState('')
  const [lowStockAlert, setLowStockAlert] = useState(true)

  // New option value inputs
  const [newOptionValues, setNewOptionValues] = useState<Record<string, string>>({})
  
  // Search filters for each option type
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({})

  // Load option types
  useEffect(() => {
    if (open) {
      loadOptionTypes()
    }
  }, [open])

  async function loadOptionTypes() {
    setIsLoading(true)
    const result = await getOptionTypesWithValues()
    if (result.success && result.data) {
      setOptionTypes(result.data)
    }
    setIsLoading(false)
  }

  // Get which option types are used by existing variants
  const usedOptionTypes = useMemo(() => {
    const types = new Set<string>()
    existingVariants.forEach(v => {
      v.options.forEach(o => types.add(o.typeName))
    })
    return types
  }, [existingVariants])

  // Filter option types to only show those used by existing variants
  const relevantOptionTypes = useMemo(() => {
    if (usedOptionTypes.size === 0) return optionTypes
    return optionTypes.filter(ot => usedOptionTypes.has(ot.name))
  }, [optionTypes, usedOptionTypes])

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
    if (Object.keys(selectedValues).length !== relevantOptionTypes.length) return false
    
    const currentCombination = relevantOptionTypes
      .map(ot => `${ot.name}:${selectedValues[ot.id]}`)
      .sort()
      .join('|')
    
    return existingCombinations.has(currentCombination)
  }, [selectedValues, relevantOptionTypes, existingCombinations])

  // Auto-generate SKU when options change
  useEffect(() => {
    if (Object.keys(selectedValues).length === relevantOptionTypes.length) {
      const suffix = relevantOptionTypes
        .map(ot => selectedValues[ot.id])
        .join('-')
      setSku(`${productSku}-${suffix}`)
    } else {
      setSku('')
    }
  }, [selectedValues, relevantOptionTypes, productSku])

  // Toggle option value selection
  const toggleValue = (optionTypeId: string, value: string) => {
    setSelectedValues(prev => {
      if (prev[optionTypeId] === value) {
        const { [optionTypeId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [optionTypeId]: value }
    })
  }

  // Add new option value
  const handleAddNewValue = async (optionType: OptionType) => {
    const newValue = newOptionValues[optionType.id]?.trim()
    if (!newValue) return

    // Check if value already exists
    if (optionType.values.some(v => v.value.toLowerCase() === newValue.toLowerCase())) {
      toast.error(`"${newValue}" มีอยู่แล้ว`)
      return
    }

    // For now, we'll create the option value inline when saving
    // Just add it to the local state
    setOptionTypes(prev => prev.map(ot => {
      if (ot.id === optionType.id) {
        return {
          ...ot,
          values: [...ot.values, { id: `new-${newValue}`, value: newValue }]
        }
      }
      return ot
    }))
    
    // Auto-select the new value
    setSelectedValues(prev => ({ ...prev, [optionType.id]: newValue }))
    setNewOptionValues(prev => ({ ...prev, [optionType.id]: '' }))
    toast.success(`เพิ่ม "${newValue}" แล้ว`)
  }

  // Reset form
  const resetForm = () => {
    setSelectedValues({})
    setSku('')
    setCostPrice(0)
    setSellingPrice(0)
    setBarcode('')
    setLowStockAlert(true)
    setNewOptionValues({})
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
      // Get or create option value IDs
      const optionValueIds: string[] = []
      
      for (const optionType of relevantOptionTypes) {
        const selectedValue = selectedValues[optionType.id]
        if (!selectedValue) continue
        
        const existingValue = optionType.values.find(v => v.value === selectedValue)
        
        if (existingValue && !existingValue.id.startsWith('new-')) {
          optionValueIds.push(existingValue.id)
        } else {
          // Need to create the option value first
          const response = await fetch('/api/options/values', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              optionTypeId: optionType.id,
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
      }

      // Create the variant
      const result = await addVariant(productId, {
        sku,
        barcode: barcode || undefined,
        name: Object.values(selectedValues).join(', '),
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
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsSaving(false)
    }
  }

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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Option Type Selectors */}
            {relevantOptionTypes.map((optionType) => {
              const searchTerm = searchFilters[optionType.id] || ''
              const filteredValues = optionType.values.filter(v => 
                v.value.toLowerCase().includes(searchTerm.toLowerCase())
              )
              const hasMany = optionType.values.length > 10
              
              return (
                <div key={optionType.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">{optionType.name}</Label>
                    {selectedValues[optionType.id] && (
                      <Badge className="bg-[var(--accent-primary)]">
                        เลือก: {selectedValues[optionType.id]}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Search filter - show when many options */}
                  {hasMany && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <Input
                        placeholder={`ค้นหา${optionType.name}... (${optionType.values.length} รายการ)`}
                        value={searchTerm}
                        onChange={(e) => setSearchFilters(prev => ({
                          ...prev,
                          [optionType.id]: e.target.value
                        }))}
                        className="pl-10"
                      />
                    </div>
                  )}
                  
                  {/* Existing values as chips */}
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                    {filteredValues.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">
                        ไม่พบ "{searchTerm}" - พิมพ์ด้านล่างเพื่อสร้างใหม่
                      </p>
                    ) : (
                      filteredValues.map((value) => {
                        const isSelected = selectedValues[optionType.id] === value.value
                        return (
                          <button
                            key={value.id}
                            type="button"
                            onClick={() => {
                              toggleValue(optionType.id, value.value)
                              // Clear search when selected
                              setSearchFilters(prev => ({ ...prev, [optionType.id]: '' }))
                            }}
                            className={`
                              px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium
                              ${isSelected 
                                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' 
                                : 'bg-[var(--bg-primary)] border-[var(--border-default)] hover:border-[var(--accent-primary)]'
                              }
                            `}
                          >
                            {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                            {value.value}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Add new value */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`+ เพิ่ม${optionType.name}ใหม่...`}
                      value={newOptionValues[optionType.id] || ''}
                      onChange={(e) => setNewOptionValues(prev => ({ 
                        ...prev, 
                        [optionType.id]: e.target.value 
                      }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddNewValue(optionType)
                        }
                      }}
                      className="max-w-[200px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddNewValue(optionType)}
                      disabled={!newOptionValues[optionType.id]?.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}

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
                  {relevantOptionTypes.map(ot => (
                    selectedValues[ot.id] && (
                      <Badge key={ot.id} variant="secondary">
                        {ot.name}: {selectedValues[ot.id]}
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
          <Button
            onClick={handleSave}
            disabled={isSaving || !sku || isDuplicate || Object.keys(selectedValues).length !== relevantOptionTypes.length}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
