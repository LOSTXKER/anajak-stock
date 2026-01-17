'use client'

import { useState } from 'react'
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
import { ListPlus, Plus, Loader2, Check, Search } from 'lucide-react'

export interface BulkAddProduct {
  id: string
  name: string
  sku: string
  hasVariants?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastCost?: any // Accepts Decimal or number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  standardCost?: any // Accepts Decimal or number
}

interface BulkAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: BulkAddProduct[]
  selectedProducts: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onConfirm: () => void | Promise<void>
  existingProductIds: Set<string>
  title?: string
  description?: string
  showVariantsBadge?: boolean
}

export function BulkAddModal({
  open,
  onOpenChange,
  products,
  selectedProducts,
  onToggleSelect,
  onToggleSelectAll,
  onConfirm,
  existingProductIds,
  title = 'เพิ่มหลายรายการ',
  description = 'เลือกสินค้าที่ต้องการเพิ่มทั้งหมด แล้วกดยืนยัน',
  showVariantsBadge = true,
}: BulkAddModalProps) {
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const handleConfirm = async () => {
    setIsAdding(true)
    try {
      await onConfirm()
    } finally {
      setIsAdding(false)
    }
  }

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

        {/* Select All */}
        <div className="flex items-center justify-between py-2 border-b border-[var(--border-default)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selectedProducts.size === products.length && products.length > 0}
              onCheckedChange={onToggleSelectAll}
            />
            <span className="text-sm font-medium">เลือกทั้งหมด</span>
          </label>
          <Badge variant="secondary">
            เลือก {selectedProducts.size} รายการ
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
                const isSelected = selectedProducts.has(product.id)
                
                return (
                  <label
                    key={product.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-[var(--accent-light)] border border-[var(--accent-primary)]' 
                        : 'hover:bg-[var(--bg-secondary)] border border-transparent'
                    } ${isExisting ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(product.id)}
                      disabled={isExisting}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{product.name}</span>
                        {showVariantsBadge && product.hasVariants && (
                          <Badge variant="secondary" className="text-xs shrink-0">Variants</Badge>
                        )}
                        {isExisting && (
                          <Badge variant="outline" className="text-xs shrink-0">เพิ่มแล้ว</Badge>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-mono">{product.sku}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
                    )}
                  </label>
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
            disabled={selectedProducts.size === 0 || isAdding}
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            เพิ่ม {selectedProducts.size} รายการ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for managing bulk add state
export function useBulkAdd() {
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)
  const [bulkSelectedProducts, setBulkSelectedProducts] = useState<Set<string>>(new Set())

  const toggleBulkSelect = (productId: string) => {
    setBulkSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const toggleSelectAll = (products: { id: string }[]) => {
    if (bulkSelectedProducts.size === products.length) {
      setBulkSelectedProducts(new Set())
    } else {
      setBulkSelectedProducts(new Set(products.map(p => p.id)))
    }
  }

  const resetBulkSelection = () => {
    setBulkSelectedProducts(new Set())
    setShowBulkAddModal(false)
  }

  return {
    showBulkAddModal,
    setShowBulkAddModal,
    bulkSelectedProducts,
    setBulkSelectedProducts,
    toggleBulkSelect,
    toggleSelectAll,
    resetBulkSelection,
  }
}
