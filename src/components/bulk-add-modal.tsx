'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ListPlus, Plus, Loader2, Check, Search, ChevronRight, ChevronDown } from 'lucide-react'

export interface BulkAddVariant {
  id: string
  sku: string
  name: string | null
  options?: { optionName: string; value: string }[]
  stock?: number
  costPrice?: number
}

export interface BulkAddProduct {
  id: string
  name: string
  sku: string
  hasVariants?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastCost?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  standardCost?: any
  variants?: BulkAddVariant[]
}

export interface BulkAddSelection {
  productId: string
  variantId?: string
  productName: string
  variantLabel?: string
  unitCost: number
}

interface BulkAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: BulkAddProduct[]
  existingProductIds: Set<string>
  existingVariantIds?: Set<string>
  onConfirm: (selections: BulkAddSelection[]) => void | Promise<void>
  loadVariants?: (productId: string) => Promise<BulkAddVariant[]>
  title?: string
  description?: string
  showVariants?: boolean
}

export function BulkAddModal({
  open,
  onOpenChange,
  products,
  existingProductIds,
  existingVariantIds = new Set(),
  onConfirm,
  loadVariants,
  title = 'เพิ่มหลายรายการ',
  description = 'เลือกสินค้าที่ต้องการเพิ่มทั้งหมด แล้วกดยืนยัน',
  showVariants = true,
}: BulkAddModalProps) {
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [loadingVariants, setLoadingVariants] = useState<Set<string>>(new Set())
  const [productVariants, setProductVariants] = useState<Record<string, BulkAddVariant[]>>({})
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()) // productId or productId:variantId
  
  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedItems(new Set())
      setExpandedProducts(new Set())
      setSearch('')
    }
  }, [open])

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggleExpand = useCallback(async (productId: string) => {
    const isExpanded = expandedProducts.has(productId)
    
    if (isExpanded) {
      setExpandedProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    } else {
      setExpandedProducts(prev => new Set(prev).add(productId))
      
      // Load variants if not already loaded
      if (!productVariants[productId] && loadVariants) {
        setLoadingVariants(prev => new Set(prev).add(productId))
        try {
          const variants = await loadVariants(productId)
          setProductVariants(prev => ({ ...prev, [productId]: variants }))
        } catch (error) {
          console.error('Failed to load variants:', error)
        } finally {
          setLoadingVariants(prev => {
            const newSet = new Set(prev)
            newSet.delete(productId)
            return newSet
          })
        }
      }
    }
  }, [expandedProducts, productVariants, loadVariants])

  const handleToggleSelect = (productId: string, variantId?: string) => {
    const key = variantId ? `${productId}:${variantId}` : productId
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const handleSelectAllVariants = (productId: string) => {
    const variants = productVariants[productId] || []
    const allSelected = variants.every(v => selectedItems.has(`${productId}:${v.id}`))
    
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // Deselect all variants
        variants.forEach(v => newSet.delete(`${productId}:${v.id}`))
      } else {
        // Select all variants that aren't already added
        variants.forEach(v => {
          if (!existingVariantIds.has(v.id)) {
            newSet.add(`${productId}:${v.id}`)
          }
        })
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const allNonVariantProducts = filteredProducts.filter(p => !p.hasVariants || !showVariants)
    const allSelected = allNonVariantProducts.every(p => selectedItems.has(p.id))
    
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        allNonVariantProducts.forEach(p => newSet.delete(p.id))
      } else {
        allNonVariantProducts.forEach(p => {
          if (!existingProductIds.has(p.id)) {
            newSet.add(p.id)
          }
        })
      }
      return newSet
    })
  }

  const handleConfirm = async () => {
    setIsAdding(true)
    try {
      const selections: BulkAddSelection[] = []
      
      for (const key of selectedItems) {
        if (key.includes(':')) {
          // It's a variant selection
          const [productId, variantId] = key.split(':')
          const product = products.find(p => p.id === productId)
          const variants = productVariants[productId] || []
          const variant = variants.find(v => v.id === variantId)
          
          if (product && variant) {
            selections.push({
              productId,
              variantId,
              productName: product.name,
              variantLabel: variant.options?.map(o => o.value).join(' / ') || variant.name || variant.sku,
              unitCost: variant.costPrice || Number(product.lastCost || product.standardCost || 0),
            })
          }
        } else {
          // It's a product selection
          const product = products.find(p => p.id === key)
          if (product) {
            selections.push({
              productId: key,
              productName: product.name,
              unitCost: Number(product.lastCost || product.standardCost || 0),
            })
          }
        }
      }
      
      await onConfirm(selections)
      onOpenChange(false)
    } finally {
      setIsAdding(false)
    }
  }

  const selectedCount = selectedItems.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            placeholder="ค้นหาสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select All (for non-variant products) */}
        <div className="flex items-center justify-between py-2 border-b border-[var(--border-default)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={filteredProducts.filter(p => !p.hasVariants || !showVariants).length > 0 && 
                       filteredProducts.filter(p => !p.hasVariants || !showVariants).every(p => selectedItems.has(p.id))}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium">เลือกทั้งหมด (ไม่มี Variants)</span>
          </label>
          <Badge variant="secondary">
            เลือก {selectedCount} รายการ
          </Badge>
        </div>

        {/* Product List */}
        <div className="flex-1 -mx-6 px-6 overflow-y-auto max-h-[400px]">
          <div className="space-y-1 py-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                ไม่พบสินค้า
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isExisting = existingProductIds.has(product.id)
                const hasVariants = product.hasVariants && showVariants
                const isExpanded = expandedProducts.has(product.id)
                const isLoadingVars = loadingVariants.has(product.id)
                const variants = productVariants[product.id] || []
                const isSelected = selectedItems.has(product.id)
                
                return (
                  <div key={product.id}>
                    {/* Product Row */}
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isSelected 
                          ? 'bg-[var(--accent-light)] border border-[var(--accent-primary)]' 
                          : 'hover:bg-[var(--bg-secondary)] border border-transparent'
                      } ${isExisting && !hasVariants ? 'opacity-50' : ''}`}
                    >
                      {/* Expand button for products with variants */}
                      {hasVariants ? (
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(product.id)}
                          className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                        >
                          {isLoadingVars ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                          ) : isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                        </button>
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(product.id)}
                          disabled={isExisting}
                        />
                      )}
                      
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => hasVariants ? handleToggleExpand(product.id) : handleToggleSelect(product.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{product.name}</span>
                          {hasVariants && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {variants.length > 0 ? `${variants.length} ตัวเลือก` : 'Variants'}
                            </Badge>
                          )}
                          {isExisting && !hasVariants && (
                            <Badge variant="outline" className="text-xs shrink-0">เพิ่มแล้ว</Badge>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] font-mono">{product.sku}</div>
                      </div>
                      
                      {isSelected && !hasVariants && (
                        <Check className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
                      )}
                    </div>
                    
                    {/* Variants List (expanded) */}
                    {hasVariants && isExpanded && (
                      <div className="ml-8 mt-1 space-y-1 pb-2">
                        {isLoadingVars ? (
                          <div className="flex items-center gap-2 p-2 text-[var(--text-muted)] text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            กำลังโหลดตัวเลือก...
                          </div>
                        ) : variants.length === 0 ? (
                          <div className="p-2 text-[var(--text-muted)] text-sm">
                            ไม่พบตัวเลือก
                          </div>
                        ) : (
                          <>
                            {/* Select all variants button */}
                            <div className="flex items-center gap-2 p-2 border-b border-[var(--border-default)]">
                              <Checkbox
                                checked={variants.every(v => selectedItems.has(`${product.id}:${v.id}`))}
                                onCheckedChange={() => handleSelectAllVariants(product.id)}
                              />
                              <span className="text-sm text-[var(--text-muted)]">เลือกทั้งหมด ({variants.length})</span>
                            </div>
                            
                            {variants.map((variant) => {
                              const variantKey = `${product.id}:${variant.id}`
                              const isVariantSelected = selectedItems.has(variantKey)
                              const isVariantExisting = existingVariantIds.has(variant.id)
                              const variantLabel = variant.options?.map(o => o.value).join(' / ') || variant.name || variant.sku
                              
                              return (
                                <label
                                  key={variant.id}
                                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                    isVariantSelected 
                                      ? 'bg-[var(--accent-light)] border border-[var(--accent-primary)]' 
                                      : 'hover:bg-[var(--bg-secondary)] border border-transparent'
                                  } ${isVariantExisting ? 'opacity-50' : ''}`}
                                >
                                  <Checkbox
                                    checked={isVariantSelected}
                                    onCheckedChange={() => handleToggleSelect(product.id, variant.id)}
                                    disabled={isVariantExisting}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{variantLabel}</span>
                                      {variant.stock !== undefined && (
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${variant.stock > 0 ? 'text-[var(--status-success)]' : 'text-[var(--status-error)]'}`}
                                        >
                                          สต๊อค: {variant.stock}
                                        </Badge>
                                      )}
                                      {isVariantExisting && (
                                        <Badge variant="outline" className="text-xs shrink-0">เพิ่มแล้ว</Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] font-mono">{variant.sku}</div>
                                  </div>
                                  {isVariantSelected && (
                                    <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                                  )}
                                </label>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--border-default)] pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedCount === 0 || isAdding}
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            เพิ่ม {selectedCount} รายการ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Simplified hook - now most state is managed inside the modal
export function useBulkAdd() {
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)

  return {
    showBulkAddModal,
    setShowBulkAddModal,
    openBulkAdd: () => setShowBulkAddModal(true),
    closeBulkAdd: () => setShowBulkAddModal(false),
  }
}
