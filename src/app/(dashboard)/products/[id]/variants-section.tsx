'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Layers, Pencil, Trash2, ChevronDown, ChevronRight, Warehouse, Save, Loader2, Plus, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { updateVariant, deleteVariant } from '@/actions/variants'
import { useRouter } from 'next/navigation'
import { AddVariantDialog } from './add-variant-dialog'
import { QuickAdjustDialog } from './quick-adjust-dialog'
import { PrintLabel, BulkPrintLabel } from '@/components/print-label'
import { StockType } from '@/types'

const stockTypeLabels: Record<StockType, string> = {
  STOCKED: 'สต๊อค',
  MADE_TO_ORDER: 'MTO',
  DROP_SHIP: 'Drop',
}

interface VariantOption {
  optionTypeId: string
  typeName: string
  optionValueId: string
  value: string
}

interface ProductOptionGroup {
  name: string
  values: string[]
}

interface StockLocation {
  locationId: string
  locationCode: string
  warehouseName: string
  qty: number
}

interface Variant {
  id: string
  sku: string
  name: string | null
  barcode: string | null
  stockType: StockType
  costPrice: number
  sellingPrice: number
  reorderPoint: number
  minQty: number
  maxQty: number
  lowStockAlert: boolean
  options: VariantOption[]
  totalStock: number
  stockByLocation: StockLocation[]
}

interface VariantsSectionProps {
  productId: string
  productSku: string
  productName: string
  variants: Variant[]
  productOptionGroups: ProductOptionGroup[]
}

// Editable variant state
interface EditableVariant extends Variant {
  isDirty?: boolean
}

export function VariantsSection({ productId, productSku, productName, variants: initialVariants, productOptionGroups }: VariantsSectionProps) {
  const router = useRouter()
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [variants, setVariants] = useState<EditableVariant[]>(
    initialVariants.map(v => ({ ...v, isDirty: false }))
  )
  const [originalVariants, setOriginalVariants] = useState<Variant[]>(initialVariants)
  const [isSaving, setIsSaving] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingVariant, setDeletingVariant] = useState<Variant | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Add variant dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  
  // Quick adjust dialog
  const [quickAdjustDialogOpen, setQuickAdjustDialogOpen] = useState(false)
  const [adjustingVariant, setAdjustingVariant] = useState<Variant | null>(null)
  
  const openQuickAdjust = (variant: Variant) => {
    setAdjustingVariant(variant)
    setQuickAdjustDialogOpen(true)
  }

  const toggleExpanded = (variantId: string) => {
    setExpandedVariants(prev => {
      const newSet = new Set(prev)
      if (newSet.has(variantId)) {
        newSet.delete(variantId)
      } else {
        newSet.add(variantId)
      }
      return newSet
    })
  }

  // Enter edit mode
  const enterEditMode = () => {
    setOriginalVariants(variants.map(v => ({ ...v })))
    setIsEditMode(true)
  }

  // Cancel edit mode - revert changes
  const cancelEditMode = () => {
    setVariants(originalVariants.map(v => ({ ...v, isDirty: false })))
    setIsEditMode(false)
  }

  // Update local variant state
  const updateLocalVariant = useCallback((variantId: string, field: keyof Variant, value: string | number | boolean | null) => {
    setVariants(prev => prev.map(v => 
      v.id === variantId 
        ? { ...v, [field]: value, isDirty: true }
        : v
    ))
  }, [])

  // Update option value for a variant (using simple string value from productOptionGroups)
  const updateVariantOption = useCallback((variantId: string, optionTypeName: string, newValue: string) => {
    setVariants(prev => prev.map(v => {
      if (v.id !== variantId) return v
      
      const newOptions = v.options.map(opt => 
        opt.typeName === optionTypeName
          ? { ...opt, value: newValue }
          : opt
      )
      
      return { ...v, options: newOptions, isDirty: true }
    }))
  }, [])

  // Save all changes
  const saveAllChanges = async () => {
    const dirtyVariants = variants.filter(v => v.isDirty)
    if (dirtyVariants.length === 0) {
      toast.info('ไม่มีการเปลี่ยนแปลง')
      setIsEditMode(false)
      return
    }

    setIsSaving(true)
    let successCount = 0
    let errorCount = 0

    for (const variant of dirtyVariants) {
      try {
        const result = await updateVariant(variant.id, {
          barcode: variant.barcode || undefined,
          stockType: variant.stockType,
          costPrice: variant.costPrice,
          sellingPrice: variant.sellingPrice,
          reorderPoint: variant.reorderPoint,
          minQty: variant.minQty,
          maxQty: variant.maxQty,
          lowStockAlert: variant.lowStockAlert,
        })

        if (result.success) {
          successCount++
        } else {
          errorCount++
          toast.error(`${variant.sku}: ${result.error}`)
        }
      } catch {
        errorCount++
        toast.error(`${variant.sku}: เกิดข้อผิดพลาด`)
      }
    }

    setIsSaving(false)

    if (successCount > 0) {
      toast.success(`บันทึกสำเร็จ ${successCount} รายการ`)
    }
    if (errorCount > 0) {
      toast.error(`บันทึกไม่สำเร็จ ${errorCount} รายการ`)
    }

    setIsEditMode(false)
    setVariants(prev => prev.map(v => ({ ...v, isDirty: false })))
    router.refresh()
  }

  const openDeleteDialog = (variant: Variant) => {
    setDeletingVariant(variant)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingVariant) return

    setIsDeleting(true)
    try {
      const result = await deleteVariant(deletingVariant.id)

      if (result.success) {
        toast.success('ลบ variant สำเร็จ')
        setDeleteDialogOpen(false)
        setVariants(prev => prev.filter(v => v.id !== deletingVariant.id))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Group variants by first option (e.g., color)
  const groupedVariants = React.useMemo(() => {
    const groups: Map<string, EditableVariant[]> = new Map()
    
    for (const variant of variants) {
      const firstOption = variant.options[0]?.value || 'อื่นๆ'
      if (!groups.has(firstOption)) {
        groups.set(firstOption, [])
      }
      groups.get(firstOption)!.push(variant)
    }
    
    return Array.from(groups.entries())
  }, [variants])

  // Get unique option type names
  const optionTypes = React.useMemo(() => {
    if (variants.length === 0) return []
    return variants[0].options.map(o => o.typeName)
  }, [variants])

  const hasDirtyVariants = variants.some(v => v.isDirty)

  return (
    <>
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
              รายการตัวเลือกสินค้า ({variants.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button 
                    onClick={cancelEditMode} 
                    size="sm" 
                    variant="outline"
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-2" />
                    ยกเลิก
                  </Button>
                  <Button 
                    onClick={saveAllChanges} 
                    size="sm"
                    disabled={isSaving || !hasDirtyVariants}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    บันทึกทั้งหมด
                  </Button>
                </>
              ) : (
                <>
                  <BulkPrintLabel 
                    products={variants.map(v => ({
                      sku: v.sku,
                      name: v.options.map(o => o.value).join(' / ') || v.name || v.sku,
                      barcode: v.barcode,
                      price: v.sellingPrice,
                    }))}
                  />
                  <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มตัวเลือก
                  </Button>
                  <Button onClick={enterEditMode} size="sm">
                    <Pencil className="w-4 h-4 mr-2" />
                    แก้ไข
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[var(--bg-tertiary)]">
                  <TableHead className="w-8"></TableHead>
                  {optionTypes.map((typeName) => (
                    <TableHead key={typeName} className="text-[var(--status-error)]">
                      ● {typeName}
                    </TableHead>
                  ))}
                  {optionTypes.length === 0 && <TableHead>ชื่อ</TableHead>}
                  <TableHead>Barcode</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ราคาขาย</TableHead>
                  <TableHead>ราคาทุน</TableHead>
                  <TableHead>Reorder</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>สต๊อค</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">แจ้งเตือน</TableHead>
                  {!isEditMode && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedVariants.map(([groupName, groupVariants], groupIdx) => (
                  <React.Fragment key={groupName}>
                    {groupVariants.map((variant, varIdx) => (
                      <React.Fragment key={variant.id}>
                        <TableRow 
                          className={`
                            ${variant.isDirty ? 'bg-[var(--status-warning)]/10' : ''}
                            ${varIdx === 0 && groupIdx > 0 ? 'border-t-2 border-[var(--border-default)]' : ''}
                          `}
                        >
                          <TableCell>
                            {variant.stockByLocation.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1 h-auto"
                                onClick={() => toggleExpanded(variant.id)}
                              >
                                {expandedVariants.has(variant.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          
                          {/* Option columns - show first option only on first row of group */}
                          {variant.options.map((opt, optIdx) => (
                            <TableCell key={optIdx}>
                              {/* Options are read-only - manage at product level */}
                              {optIdx === 0 ? (
                                varIdx === 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-medium">
                                      {opt.value.substring(0, 2)}
                                    </div>
                                    <span className="font-medium">{opt.value}</span>
                                  </div>
                                ) : null
                              ) : (
                                <span className={varIdx === 0 ? 'font-medium text-[var(--accent-primary)]' : ''}>
                                  {opt.value}
                                </span>
                              )}
                            </TableCell>
                          ))}
                          
                          {optionTypes.length === 0 && (
                            <TableCell>
                              <span className="font-medium">{variant.name || variant.sku}</span>
                            </TableCell>
                          )}

                          {/* Barcode */}
                          <TableCell>
                            {isEditMode ? (
                              <Input
                                value={variant.barcode || ''}
                                onChange={(e) => updateLocalVariant(variant.id, 'barcode', e.target.value || null)}
                                className="h-8 w-32 font-mono text-xs"
                                placeholder="-"
                              />
                            ) : (
                              <span className="font-mono text-xs text-[var(--text-muted)]">
                                {variant.barcode || '-'}
                              </span>
                            )}
                          </TableCell>

                          {/* ประเภทสต๊อค */}
                          <TableCell>
                            {isEditMode ? (
                              <Select
                                value={variant.stockType}
                                onValueChange={(v) => updateLocalVariant(variant.id, 'stockType', v)}
                              >
                                <SelectTrigger className="h-8 w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(stockTypeLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {stockTypeLabels[variant.stockType]}
                              </Badge>
                            )}
                          </TableCell>

                          {/* ราคาขาย */}
                          <TableCell>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variant.sellingPrice || ''}
                                onChange={(e) => updateLocalVariant(variant.id, 'sellingPrice', Number(e.target.value))}
                                className="h-8 w-20"
                              />
                            ) : (
                              <span>฿{variant.sellingPrice.toLocaleString()}</span>
                            )}
                          </TableCell>

                          {/* ราคาทุน */}
                          <TableCell>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variant.costPrice || ''}
                                onChange={(e) => updateLocalVariant(variant.id, 'costPrice', Number(e.target.value))}
                                className="h-8 w-20"
                              />
                            ) : (
                              <span className="text-[var(--text-muted)]">฿{variant.costPrice.toLocaleString()}</span>
                            )}
                          </TableCell>

                          {/* Reorder Point */}
                          <TableCell>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={variant.reorderPoint || ''}
                                onChange={(e) => updateLocalVariant(variant.id, 'reorderPoint', Number(e.target.value))}
                                className="h-8 w-16"
                              />
                            ) : (
                              <span className="text-[var(--text-muted)]">{variant.reorderPoint}</span>
                            )}
                          </TableCell>

                          {/* Min Qty */}
                          <TableCell>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={variant.minQty || ''}
                                onChange={(e) => updateLocalVariant(variant.id, 'minQty', Number(e.target.value))}
                                className="h-8 w-16"
                              />
                            ) : (
                              <span className="text-[var(--text-muted)]">{variant.minQty}</span>
                            )}
                          </TableCell>

                          {/* Max Qty */}
                          <TableCell>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={variant.maxQty || ''}
                                onChange={(e) => updateLocalVariant(variant.id, 'maxQty', Number(e.target.value))}
                                className="h-8 w-16"
                              />
                            ) : (
                              <span className="text-[var(--text-muted)]">{variant.maxQty}</span>
                            )}
                          </TableCell>

                          {/* สต๊อค */}
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                variant.totalStock > 0
                                  ? 'bg-[var(--status-success-light)] text-[var(--status-success)] border-[var(--status-success)]/20'
                                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-default)]'
                              }
                            >
                              {variant.totalStock.toLocaleString()}
                            </Badge>
                          </TableCell>

                          {/* SKU */}
                          <TableCell className="font-mono text-xs">
                            {variant.sku}
                          </TableCell>

                          {/* แจ้งเตือน */}
                          <TableCell className="text-center">
                            {isEditMode ? (
                              <Checkbox
                                checked={variant.lowStockAlert}
                                onCheckedChange={(checked) => updateLocalVariant(variant.id, 'lowStockAlert', !!checked)}
                              />
                            ) : (
                              <span>{variant.lowStockAlert ? '✓' : '-'}</span>
                            )}
                          </TableCell>

                          {/* Actions (View Mode only) */}
                          {!isEditMode && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openQuickAdjust(variant)}
                                  title="ปรับยอดสต๊อค"
                                >
                                  <RefreshCw className="w-4 h-4 text-[var(--status-warning)]" />
                                </Button>
                                <PrintLabel 
                                  variant="icon"
                                  product={{
                                    sku: variant.sku,
                                    name: variant.options.map(o => o.value).join(' / ') || variant.name || variant.sku,
                                    barcode: variant.barcode,
                                    price: variant.sellingPrice,
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteDialog(variant)}
                                >
                                  <Trash2 className="w-4 h-4 text-[var(--status-error)]" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        
                        {/* Expanded stock by location */}
                        {expandedVariants.has(variant.id) && variant.stockByLocation.length > 0 && (
                          <TableRow className="bg-[var(--bg-secondary)]">
                            <TableCell colSpan={optionTypes.length + (isEditMode ? 13 : 14)} className="p-0">
                              <div className="px-8 py-4">
                                <div className="flex items-center gap-2 mb-3 text-sm text-[var(--text-muted)]">
                                  <Warehouse className="w-4 h-4" />
                                  สต๊อคตาม Location
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  {variant.stockByLocation.map((loc) => (
                                    <div
                                      key={loc.locationId}
                                      className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-3"
                                    >
                                      <p className="text-[var(--text-muted)] text-xs">{loc.warehouseName}</p>
                                      <p className="font-mono text-sm">{loc.locationCode}</p>
                                      <p className="text-[var(--status-success)] font-bold mt-1">
                                        {loc.qty.toLocaleString()} ชิ้น
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบ variant &quot;{deletingVariant?.sku}&quot; ใช่หรือไม่?
              {deletingVariant && deletingVariant.totalStock > 0 && (
                <span className="block text-[var(--status-warning)] mt-2">
                  ⚠ variant นี้มีสต๊อคอยู่ {deletingVariant.totalStock} ชิ้น
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'กำลังลบ...' : 'ลบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Variant Dialog */}
      <AddVariantDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        productId={productId}
        productSku={productSku}
        productName={productName}
        existingVariants={variants.map(v => ({
          id: v.id,
          sku: v.sku,
          options: v.options,
        }))}
        productOptionGroups={productOptionGroups}
      />
      
      {/* Quick Adjust Dialog */}
      {adjustingVariant && (
        <QuickAdjustDialog
          open={quickAdjustDialogOpen}
          onOpenChange={(open) => {
            setQuickAdjustDialogOpen(open)
            if (!open) setAdjustingVariant(null)
          }}
          variant={{
            id: adjustingVariant.id,
            sku: adjustingVariant.sku,
            name: adjustingVariant.name,
            productId: productId,
            productName: productName,
            options: adjustingVariant.options.map(o => ({
              typeName: o.typeName,
              value: o.value,
            })),
            stockByLocation: adjustingVariant.stockByLocation,
          }}
        />
      )}
    </>
  )
}
