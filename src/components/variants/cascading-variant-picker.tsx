'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronDown, Package, Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface VariantOption {
  optionName: string
  value: string
}

interface Variant {
  id: string
  sku: string
  name: string | null
  options: VariantOption[]
  stock?: number
  sellingPrice?: number
  costPrice?: number
}

interface CascadingVariantPickerProps {
  variants: Variant[]
  selectedVariantId?: string | null
  onSelect: (variant: Variant | null) => void
  disabled?: boolean
  placeholder?: string
  showStock?: boolean
  showPrice?: boolean
  className?: string
}

export function CascadingVariantPicker({
  variants,
  selectedVariantId,
  onSelect,
  disabled = false,
  placeholder = 'เลือกตัวเลือก',
  showStock = true,
  showPrice = false,
  className,
}: CascadingVariantPickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({})

  // Get unique option types and their values
  const optionStructure = useMemo(() => {
    if (variants.length === 0) return []

    const structure: Array<{
      name: string
      values: Array<{ value: string; available: boolean }>
    }> = []

    // Get all unique option names in order
    const firstVariant = variants[0]
    const optionNames = firstVariant.options.map(o => o.optionName)

    for (const optionName of optionNames) {
      const allValues = new Set<string>()
      variants.forEach(v => {
        const opt = v.options.find(o => o.optionName === optionName)
        if (opt) allValues.add(opt.value)
      })

      structure.push({
        name: optionName,
        values: Array.from(allValues).map(value => ({
          value,
          available: true, // Will be updated based on selection
        })),
      })
    }

    return structure
  }, [variants])

  // Get available values for each option based on current selection
  const availableOptions = useMemo(() => {
    return optionStructure.map((opt, idx) => {
      // For the first option, all values are available
      if (idx === 0) {
        return {
          ...opt,
          values: opt.values.map(v => ({
            ...v,
            available: true,
            count: variants.filter(variant =>
              variant.options.some(o => o.optionName === opt.name && o.value === v.value)
            ).length,
          })),
        }
      }

      // For subsequent options, filter based on previous selections
      const previousSelections = optionStructure.slice(0, idx).map(o => ({
        name: o.name,
        value: selectedOptions[o.name],
      }))

      // Filter variants that match all previous selections
      const matchingVariants = variants.filter(variant =>
        previousSelections.every(sel =>
          !sel.value || variant.options.some(o => o.optionName === sel.name && o.value === sel.value)
        )
      )

      return {
        ...opt,
        values: opt.values.map(v => {
          const available = matchingVariants.some(variant =>
            variant.options.some(o => o.optionName === opt.name && o.value === v.value)
          )
          const count = matchingVariants.filter(variant =>
            variant.options.some(o => o.optionName === opt.name && o.value === v.value)
          ).length
          return { ...v, available, count }
        }),
      }
    })
  }, [optionStructure, selectedOptions, variants])

  // Find selected variant based on all selected options
  const selectedVariant = useMemo(() => {
    if (Object.keys(selectedOptions).length !== optionStructure.length) return null

    return variants.find(v =>
      v.options.every(o => selectedOptions[o.optionName] === o.value)
    ) || null
  }, [selectedOptions, variants, optionStructure])

  // Update selected options when selectedVariantId changes
  useEffect(() => {
    if (selectedVariantId) {
      const variant = variants.find(v => v.id === selectedVariantId)
      if (variant) {
        const options: Record<string, string> = {}
        variant.options.forEach(o => {
          options[o.optionName] = o.value
        })
        setSelectedOptions(options)
      }
    } else {
      setSelectedOptions({})
    }
  }, [selectedVariantId, variants])

  // Handle option selection
  const handleOptionSelect = (optionName: string, value: string) => {
    const newSelected = { ...selectedOptions }
    
    // If same value is selected, deselect
    if (newSelected[optionName] === value) {
      delete newSelected[optionName]
      // Also clear all subsequent options
      const optIdx = optionStructure.findIndex(o => o.name === optionName)
      optionStructure.slice(optIdx + 1).forEach(o => delete newSelected[o.name])
    } else {
      newSelected[optionName] = value
      // Clear subsequent options when a previous option changes
      const optIdx = optionStructure.findIndex(o => o.name === optionName)
      optionStructure.slice(optIdx + 1).forEach(o => delete newSelected[o.name])
    }
    
    setSelectedOptions(newSelected)

    // Check if all options are selected
    if (Object.keys(newSelected).length === optionStructure.length) {
      const variant = variants.find(v =>
        v.options.every(o => newSelected[o.optionName] === o.value)
      )
      if (variant) {
        onSelect(variant)
        setOpen(false)
      }
    }
  }

  // Clear selection
  const handleClear = () => {
    setSelectedOptions({})
    onSelect(null)
  }

  // Get display text
  const displayText = useMemo(() => {
    if (selectedVariant) {
      return selectedVariant.name || selectedVariant.options.map(o => o.value).join(' / ')
    }
    if (Object.keys(selectedOptions).length > 0) {
      return Object.values(selectedOptions).join(' / ') + '...'
    }
    return placeholder
  }, [selectedVariant, selectedOptions, placeholder])

  if (variants.length === 0) {
    return (
      <Button variant="outline" disabled className={className}>
        <Package className="w-4 h-4 mr-2" />
        ไม่มีตัวเลือก
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-between min-w-[200px]',
            selectedVariant && 'border-[var(--accent-primary)]',
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedVariant && <Check className="w-4 h-4 text-[var(--status-success)]" />}
            {displayText}
          </span>
          <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Option selectors */}
          {availableOptions.map((opt, idx) => {
            const searchTerm = searchFilters[opt.name] || ''
            const filteredValues = opt.values.filter(v => 
              v.value.toLowerCase().includes(searchTerm.toLowerCase())
            )
            const hasMany = opt.values.length > 8
            const isDisabled = idx > 0 && !selectedOptions[optionStructure[idx - 1].name]
            
            return (
              <div key={opt.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {opt.name}
                    {selectedOptions[opt.name] && (
                      <span className="ml-2 text-[var(--accent-primary)]">
                        ✓ {selectedOptions[opt.name]}
                      </span>
                    )}
                  </span>
                  {isDisabled && (
                    <span className="text-xs text-[var(--text-muted)]">
                      เลือก {optionStructure[idx - 1].name} ก่อน
                    </span>
                  )}
                </div>
                
                {/* Search filter for many options */}
                {hasMany && !isDisabled && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
                    <Input
                      placeholder={`ค้นหา${opt.name}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchFilters(prev => ({
                        ...prev,
                        [opt.name]: e.target.value
                      }))}
                      className="h-8 pl-7 text-sm"
                    />
                  </div>
                )}
                
                <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {filteredValues.length === 0 && searchTerm ? (
                    <span className="text-xs text-[var(--text-muted)]">ไม่พบ "{searchTerm}"</span>
                  ) : (
                    filteredValues.map((val) => {
                      const isSelected = selectedOptions[opt.name] === val.value
                      
                      return (
                        <button
                          key={val.value}
                          onClick={() => {
                            if (!isDisabled && val.available) {
                              handleOptionSelect(opt.name, val.value)
                              setSearchFilters(prev => ({ ...prev, [opt.name]: '' }))
                            }
                          }}
                          disabled={isDisabled || !val.available}
                          className={cn(
                            'px-2.5 py-1 text-sm rounded-md border transition-all',
                            isSelected
                              ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                              : val.available && !isDisabled
                                ? 'bg-[var(--bg-primary)] border-[var(--border-default)] hover:border-[var(--accent-primary)]'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-muted)] cursor-not-allowed opacity-50',
                          )}
                        >
                          {val.value}
                          {showStock && val.count !== undefined && val.count > 0 && (
                            <span className="ml-1 text-xs opacity-70">({val.count})</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}

          {/* Selected variant info */}
          {selectedVariant && (
            <div className="pt-3 border-t border-[var(--border-default)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">SKU:</span>
                <span className="font-mono">{selectedVariant.sku}</span>
              </div>
              {showStock && selectedVariant.stock !== undefined && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[var(--text-muted)]">สต๊อค:</span>
                  <Badge variant="outline" className={
                    selectedVariant.stock > 0
                      ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                      : 'bg-[var(--status-error)]/10 text-[var(--status-error)]'
                  }>
                    {selectedVariant.stock.toLocaleString()}
                  </Badge>
                </div>
              )}
              {showPrice && selectedVariant.sellingPrice !== undefined && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[var(--text-muted)]">ราคา:</span>
                  <span className="font-medium text-[var(--status-success)]">
                    ฿{selectedVariant.sellingPrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              ล้างการเลือก
            </Button>
            {selectedVariant && (
              <Button size="sm" onClick={() => setOpen(false)} className="bg-[var(--accent-primary)]">
                ยืนยัน
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Compact version for tables
export function CascadingVariantPickerCompact({
  variants,
  selectedVariantId,
  onSelect,
  disabled = false,
}: Omit<CascadingVariantPickerProps, 'className' | 'showStock' | 'showPrice' | 'placeholder'>) {
  const selectedVariant = variants.find(v => v.id === selectedVariantId)

  return (
    <div className="flex items-center gap-2">
      {variants[0]?.options.map((_, idx) => {
        const optionName = variants[0].options[idx].optionName
        const uniqueValues = [...new Set(variants.map(v => v.options[idx]?.value).filter(Boolean))]

        return (
          <Select
            key={optionName}
            value={selectedVariant?.options[idx]?.value || '__none__'}
            onValueChange={(value) => {
              if (value === '__none__') {
                onSelect(null)
                return
              }
              // Find variant matching this selection
              const matchingVariant = variants.find(v => v.options[idx]?.value === value)
              if (matchingVariant) {
                onSelect(matchingVariant)
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue placeholder={optionName} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">เลือก{optionName}</SelectItem>
              {uniqueValues.map(value => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
    </div>
  )
}
