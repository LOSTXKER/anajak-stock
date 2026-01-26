'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X, Palette, Ruler, Image as ImageIcon, Trash2, RefreshCw, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'

// Editable Value Component
function EditableValue({ 
  value, 
  onUpdate, 
  onRemove,
  showColorIcon = false
}: { 
  value: string
  onUpdate: (newValue: string) => void
  onRemove: () => void
  showColorIcon?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== value) {
      onUpdate(trimmed)
    } else {
      setEditValue(value)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-md border border-[var(--accent-primary)] px-2 py-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-6 w-20 text-sm px-1 py-0"
        />
        <button
          type="button"
          onClick={handleSave}
          className="text-[var(--status-success)] hover:text-[var(--status-success)]/80"
        >
          <Check className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-md px-3 py-1.5 group">
      {showColorIcon && (
        <button className="w-6 h-6 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-[var(--bg-tertiary)]">
          <ImageIcon className="w-3 h-3 text-[var(--text-muted)]" />
        </button>
      )}
      <span 
        className="text-sm cursor-pointer hover:underline"
        onClick={() => setIsEditing(true)}
        title="คลิกเพื่อแก้ไข"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
        title="แก้ไข"
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--status-error)]"
        title="ลบ"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// Size presets
const SIZE_PRESETS = {
  'สากล': ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
  'US': ['0', '2', '4', '6', '8', '10', '12', '14', '16'],
  'EU': ['32', '34', '36', '38', '40', '42', '44', '46', '48'],
  'UK': ['4', '6', '8', '10', '12', '14', '16', '18', '20'],
  'เสื้อผ้าไทย': ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
  'ตั้งค่าเอง': [],
}

interface OptionConfig {
  id: string
  name: string
  values: Array<{
    id: string
    value: string
    imageUrl?: string
  }>
}

interface GeneratedVariant {
  key: string // combination key like "ขาว-M"
  options: Array<{ optionName: string; value: string }>
  sku: string
  costPrice: number
  sellingPrice: number
  stock: number
  barcode: string
  enabled: boolean
}

interface VariantMatrixBuilderProps {
  productSku: string
  existingOptions?: OptionConfig[]
  existingVariants?: GeneratedVariant[]
  onVariantsChange: (variants: GeneratedVariant[]) => void
  onOptionsChange: (options: OptionConfig[]) => void
}

export function VariantMatrixBuilder({
  productSku,
  existingOptions = [],
  existingVariants = [],
  onVariantsChange,
  onOptionsChange,
}: VariantMatrixBuilderProps) {
  const [options, setOptions] = useState<OptionConfig[]>(existingOptions)
  const [variants, setVariants] = useState<GeneratedVariant[]>(existingVariants)
  const [selectedSizePreset, setSelectedSizePreset] = useState<string>('ตั้งค่าเอง')
  
  // Batch update values
  const [batchPrice, setBatchPrice] = useState('')
  const [batchCost, setBatchCost] = useState('')
  const [batchStock, setBatchStock] = useState('')

  // Generate variants from options
  const generateVariants = useCallback(() => {
    if (options.length === 0 || options.some(o => o.values.length === 0)) {
      setVariants([])
      return
    }

    // Generate all combinations
    const combinations: Array<Array<{ optionName: string; value: string }>> = []
    
    function combine(index: number, current: Array<{ optionName: string; value: string }>) {
      if (index === options.length) {
        combinations.push([...current])
        return
      }
      
      for (const val of options[index].values) {
        current.push({ optionName: options[index].name, value: val.value })
        combine(index + 1, current)
        current.pop()
      }
    }
    
    combine(0, [])

    // Create variants
    const newVariants: GeneratedVariant[] = combinations.map((combo, idx) => {
      const key = combo.map(c => c.value).join('-')
      const existingVariant = variants.find(v => v.key === key)
      
      // Generate SKU: ProductSKU-ColorCode-Size
      const variantSku = `${productSku}-${combo.map(c => c.value.substring(0, 2).toUpperCase()).join('-')}-${String(idx + 1).padStart(3, '0')}`
      
      return existingVariant || {
        key,
        options: combo,
        sku: variantSku,
        costPrice: 0,
        sellingPrice: 0,
        stock: 0,
        barcode: '',
        enabled: true,
      }
    })

    setVariants(newVariants)
    onVariantsChange(newVariants)
  }, [options, productSku, variants, onVariantsChange])

  // Add new option type
  const addOption = () => {
    const newOption: OptionConfig = {
      id: `opt-${Date.now()}`,
      name: options.length === 0 ? 'สี' : options.length === 1 ? 'ไซส์' : `ตัวเลือก ${options.length + 1}`,
      values: [],
    }
    const updated = [...options, newOption]
    setOptions(updated)
    onOptionsChange(updated)
  }

  // Remove option type
  const removeOption = (optionId: string) => {
    const updated = options.filter(o => o.id !== optionId)
    setOptions(updated)
    onOptionsChange(updated)
    // Regenerate variants
    setTimeout(generateVariants, 0)
  }

  // Update option name
  const updateOptionName = (optionId: string, name: string) => {
    const updated = options.map(o => o.id === optionId ? { ...o, name } : o)
    setOptions(updated)
    onOptionsChange(updated)
  }

  // Add value to option
  const addValueToOption = (optionId: string, value: string) => {
    if (!value.trim()) return
    
    const updated = options.map(o => {
      if (o.id === optionId) {
        // Check if value already exists
        if (o.values.some(v => v.value.toLowerCase() === value.toLowerCase())) {
          toast.error('ค่านี้มีอยู่แล้ว')
          return o
        }
        return {
          ...o,
          values: [...o.values, { id: `val-${Date.now()}`, value: value.trim() }],
        }
      }
      return o
    })
    setOptions(updated)
    onOptionsChange(updated)
  }

  // Remove value from option
  const removeValueFromOption = (optionId: string, valueId: string) => {
    const updated = options.map(o => {
      if (o.id === optionId) {
        return {
          ...o,
          values: o.values.filter(v => v.id !== valueId),
        }
      }
      return o
    })
    setOptions(updated)
    onOptionsChange(updated)
  }

  // Update value in option
  const updateValueInOption = (optionId: string, valueId: string, newValue: string) => {
    const updated = options.map(o => {
      if (o.id === optionId) {
        // Check if value already exists
        if (o.values.some(v => v.id !== valueId && v.value.toLowerCase() === newValue.toLowerCase())) {
          toast.error('ค่านี้มีอยู่แล้ว')
          return o
        }
        return {
          ...o,
          values: o.values.map(v => v.id === valueId ? { ...v, value: newValue } : v),
        }
      }
      return o
    })
    setOptions(updated)
    onOptionsChange(updated)
  }

  // Apply size preset
  const applySizePreset = (preset: string) => {
    setSelectedSizePreset(preset)
    if (preset === 'ตั้งค่าเอง') return
    
    const sizeOption = options.find(o => o.name === 'ไซส์')
    if (!sizeOption) {
      toast.error('กรุณาเพิ่มตัวเลือก "ไซส์" ก่อน')
      return
    }
    
    const presetValues = SIZE_PRESETS[preset as keyof typeof SIZE_PRESETS] || []
    const updated = options.map(o => {
      if (o.id === sizeOption.id) {
        return {
          ...o,
          values: presetValues.map((v, i) => ({ id: `val-${Date.now()}-${i}`, value: v })),
        }
      }
      return o
    })
    setOptions(updated)
    onOptionsChange(updated)
  }

  // Update single variant
  const updateVariant = (key: string, field: keyof GeneratedVariant, value: unknown) => {
    const updated = variants.map(v => {
      if (v.key === key) {
        return { ...v, [field]: value }
      }
      return v
    })
    setVariants(updated)
    onVariantsChange(updated)
  }

  // Batch update all variants
  const applyBatchUpdate = () => {
    const updated = variants.map(v => ({
      ...v,
      ...(batchPrice ? { sellingPrice: parseFloat(batchPrice) } : {}),
      ...(batchCost ? { costPrice: parseFloat(batchCost) } : {}),
      ...(batchStock ? { stock: parseInt(batchStock) } : {}),
    }))
    setVariants(updated)
    onVariantsChange(updated)
    toast.success('อัพเดตทั้งหมดแล้ว')
    setBatchPrice('')
    setBatchCost('')
    setBatchStock('')
  }

  // Group variants by first option (color)
  const groupedVariants = React.useMemo(() => {
    if (options.length === 0) return []
    
    const groups: Map<string, GeneratedVariant[]> = new Map()
    
    for (const variant of variants) {
      const firstOptionValue = variant.options[0]?.value || 'อื่นๆ'
      if (!groups.has(firstOptionValue)) {
        groups.set(firstOptionValue, [])
      }
      groups.get(firstOptionValue)!.push(variant)
    }
    
    return Array.from(groups.entries())
  }, [variants, options])

  return (
    <div className="space-y-6">
      {/* Option Types */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
              ตัวเลือกสินค้า
            </span>
            {options.length < 3 && (
              <Button variant="outline" size="sm" onClick={addOption}>
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มตัวเลือก
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {options.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>ยังไม่มีตัวเลือกสินค้า</p>
              <Button variant="outline" className="mt-3" onClick={addOption}>
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มตัวเลือก (เช่น สี, ไซส์)
              </Button>
            </div>
          ) : (
            options.map((option, optIdx) => (
              <div
                key={option.id}
                className="border border-[var(--border-default)] rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                      ตัวเลือก {optIdx + 1}
                    </Badge>
                    <Input
                      value={option.name}
                      onChange={(e) => updateOptionName(option.id, e.target.value)}
                      className="w-32 h-8"
                      placeholder="ชื่อตัวเลือก"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(option.id)}
                    className="text-[var(--status-error)] hover:text-[var(--status-error)]"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Size presets for size option */}
                {option.name.toLowerCase().includes('ไซส์') || option.name.toLowerCase().includes('size') ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.keys(SIZE_PRESETS).map((preset) => (
                      <Button
                        key={preset}
                        variant={selectedSizePreset === preset ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applySizePreset(preset)}
                        className={selectedSizePreset === preset ? 'bg-[var(--accent-primary)]' : ''}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                ) : null}

                {/* Option values */}
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                    ตัวเลือก <span className="text-xs opacity-60">(คลิกที่ค่าเพื่อแก้ไข)</span>
                    <span className="text-[var(--status-error)]">●</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((val) => (
                      <EditableValue
                        key={val.id}
                        value={val.value}
                        onUpdate={(newValue) => updateValueInOption(option.id, val.id, newValue)}
                        onRemove={() => removeValueFromOption(option.id, val.id)}
                        showColorIcon={option.name.toLowerCase().includes('สี')}
                      />
                    ))}
                    <AddValueInput
                      placeholder={option.name.toLowerCase().includes('สี') ? 'เพิ่มสี...' : 'เพิ่มค่า...'}
                      onAdd={(value) => addValueToOption(option.id, value)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Generate button */}
          {options.length > 0 && options.every(o => o.values.length > 0) && (
            <Button onClick={generateVariants} className="w-full bg-[var(--accent-primary)]">
              <RefreshCw className="w-4 h-4 mr-2" />
              สร้างรายการตัวเลือก ({options.reduce((acc, o) => acc * o.values.length, 1)} รายการ)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Variant Matrix Table */}
      {variants.length > 0 && (
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[var(--status-success)]" />
                รายการตัวเลือกสินค้า ({variants.length} รายการ)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Batch update bar */}
            <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-default)]">
              <span className="text-sm text-[var(--text-muted)]">อัพเดตทั้งหมด:</span>
              <div className="flex items-center gap-1">
                <span className="text-sm">฿</span>
                <Input
                  type="number"
                  placeholder="ราคาขาย"
                  value={batchPrice}
                  onChange={(e) => setBatchPrice(e.target.value)}
                  className="w-24 h-8"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm">฿</span>
                <Input
                  type="number"
                  placeholder="ต้นทุน"
                  value={batchCost}
                  onChange={(e) => setBatchCost(e.target.value)}
                  className="w-24 h-8"
                />
              </div>
              <Input
                type="number"
                placeholder="สต๊อค"
                value={batchStock}
                onChange={(e) => setBatchStock(e.target.value)}
                className="w-20 h-8"
              />
              <Button
                size="sm"
                onClick={applyBatchUpdate}
                disabled={!batchPrice && !batchCost && !batchStock}
                className="bg-[var(--status-error)] hover:bg-[var(--status-error)]/90"
              >
                อัพเดตทั้งหมด
              </Button>
            </div>

            {/* Grouped table */}
            <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--bg-tertiary)]">
                    <TableHead className="w-8">
                      <Checkbox />
                    </TableHead>
                    {options.map((opt) => (
                      <TableHead key={opt.id} className="text-[var(--status-error)]">
                        ● {opt.name}
                      </TableHead>
                    ))}
                    <TableHead>* ราคาขาย</TableHead>
                    <TableHead>* ต้นทุน</TableHead>
                    <TableHead>* สต๊อค</TableHead>
                    <TableHead>เลข SKU</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedVariants.map(([groupName, groupVariants], groupIdx) => (
                    <React.Fragment key={groupName}>
                      {groupVariants.map((variant, varIdx) => (
                        <TableRow
                          key={variant.key}
                          className={varIdx === 0 && groupIdx > 0 ? 'border-t-2 border-[var(--border-default)]' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={variant.enabled}
                              onCheckedChange={(checked) => updateVariant(variant.key, 'enabled', !!checked)}
                            />
                          </TableCell>
                          {variant.options.map((opt, optIdx) => (
                            <TableCell key={optIdx}>
                              {optIdx === 0 && varIdx === 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-10 h-10 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center">
                                    <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
                                  </div>
                                  <span className="font-medium">{opt.value}</span>
                                </div>
                              ) : optIdx === 0 ? null : (
                                <span className={varIdx === 0 ? 'font-medium text-[var(--accent-primary)]' : ''}>
                                  {opt.value}
                                </span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-[var(--text-muted)]">฿</span>
                              <Input
                                type="number"
                                value={variant.sellingPrice || ''}
                                onChange={(e) => updateVariant(variant.key, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                className="w-24 h-8"
                                placeholder="0"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-[var(--text-muted)]">฿</span>
                              <Input
                                type="number"
                                value={variant.costPrice || ''}
                                onChange={(e) => updateVariant(variant.key, 'costPrice', parseFloat(e.target.value) || 0)}
                                className="w-24 h-8"
                                placeholder="0"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={variant.stock || ''}
                              onChange={(e) => updateVariant(variant.key, 'stock', parseInt(e.target.value) || 0)}
                              className="w-20 h-8"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={variant.sku}
                              onChange={(e) => updateVariant(variant.key, 'sku', e.target.value)}
                              className="w-32 h-8 font-mono text-xs"
                              placeholder="SKU"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={variant.barcode}
                              onChange={(e) => updateVariant(variant.key, 'barcode', e.target.value)}
                              className="w-28 h-8 font-mono text-xs"
                              placeholder="Barcode"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateVariant(variant.key, 'enabled', false)}
                              className="text-[var(--status-error)] hover:text-[var(--status-error)]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper component for adding values
function AddValueInput({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim())
      setValue('')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder={placeholder}
        className="w-32 h-8"
      />
      <Button variant="ghost" size="sm" onClick={handleAdd} disabled={!value.trim()}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  )
}
