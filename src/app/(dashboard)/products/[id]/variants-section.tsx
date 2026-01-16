'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Layers, Pencil, Trash2, ChevronDown, ChevronRight, Warehouse, Save, Loader2, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { updateVariant, deleteVariant } from '@/actions/variants'
import { useRouter } from 'next/navigation'
import { AddVariantDialog } from './add-variant-dialog'
import { PrintLabel, BulkPrintLabel } from '@/components/print-label'

interface VariantOption {
  typeName: string
  value: string
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
  costPrice: number
  sellingPrice: number
  reorderPoint: number
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
}

// Local state for inline editing
interface EditableVariant extends Variant {
  isEditing?: boolean
  isDirty?: boolean
}

export function VariantsSection({ productId, productSku, productName, variants: initialVariants }: VariantsSectionProps) {
  const router = useRouter()
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const [variants, setVariants] = useState<EditableVariant[]>(
    initialVariants.map(v => ({ ...v, isEditing: false, isDirty: false }))
  )
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingVariant, setDeletingVariant] = useState<Variant | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Add variant dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)

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

  // Update local variant state
  const updateLocalVariant = useCallback((variantId: string, field: keyof Variant, value: string | number | boolean) => {
    setVariants(prev => prev.map(v => 
      v.id === variantId 
        ? { ...v, [field]: value, isDirty: true }
        : v
    ))
  }, [])

  // Save single variant
  const saveVariant = async (variant: EditableVariant) => {
    setSavingIds(prev => new Set(prev).add(variant.id))
    
    try {
      const result = await updateVariant(variant.id, {
        name: variant.name || undefined,
        costPrice: variant.costPrice,
        sellingPrice: variant.sellingPrice,
        reorderPoint: variant.reorderPoint,
        lowStockAlert: variant.lowStockAlert,
      })

      if (result.success) {
        toast.success(`อัปเดต ${variant.name || variant.sku} สำเร็จ`)
        setVariants(prev => prev.map(v => 
          v.id === variant.id ? { ...v, isDirty: false } : v
        ))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(variant.id)
        return newSet
      })
    }
  }

  // Save all dirty variants
  const saveAllChanges = async () => {
    const dirtyVariants = variants.filter(v => v.isDirty)
    if (dirtyVariants.length === 0) {
      toast.info('ไม่มีการเปลี่ยนแปลง')
      return
    }

    for (const variant of dirtyVariants) {
      await saveVariant(variant)
    }
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

  const hasDirtyVariants = variants.some(v => v.isDirty)

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

  return (
    <>
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
              รายการตัวเลือกสินค้า ({variants.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasDirtyVariants && (
                <Button onClick={saveAllChanges} size="sm" variant="outline">
                  <Save className="w-4 h-4 mr-2" />
                  บันทึกทั้งหมด
                </Button>
              )}
              <BulkPrintLabel 
                products={variants.map(v => ({
                  sku: v.sku,
                  name: v.options.map(o => o.value).join(' / ') || v.name || v.sku,
                  barcode: v.barcode,
                  price: v.sellingPrice,
                }))}
              />
              <Button onClick={() => setAddDialogOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มตัวเลือก
              </Button>
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
                  <TableHead>* ราคาขาย</TableHead>
                  <TableHead>* ราคาทุน</TableHead>
                  <TableHead>สต๊อค</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">แจ้งเตือน</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedVariants.map(([groupName, groupVariants], groupIdx) => (
                  <React.Fragment key={groupName}>
                    {groupVariants.map((variant, varIdx) => (
                      <React.Fragment key={variant.id}>
                        <TableRow 
                          className={`
                            ${variant.isDirty ? 'bg-[var(--status-warning)]/5' : ''}
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
                            {optIdx === 0 ? (
                              varIdx === 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-10 h-10 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-medium">
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
                            <Input
                              value={variant.name || variant.sku}
                              onChange={(e) => updateLocalVariant(variant.id, 'name', e.target.value)}
                              className="h-8 w-32"
                            />
                          </TableCell>
                        )}
                        {/* ราคาขาย */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[var(--text-muted)]">฿</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variant.sellingPrice || ''}
                              onChange={(e) => updateLocalVariant(variant.id, 'sellingPrice', Number(e.target.value))}
                              className="h-8 w-24"
                              placeholder="0"
                            />
                          </div>
                        </TableCell>
                        {/* ราคาทุน */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[var(--text-muted)]">฿</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variant.costPrice || ''}
                              onChange={(e) => updateLocalVariant(variant.id, 'costPrice', Number(e.target.value))}
                              className="h-8 w-24"
                              placeholder="0"
                            />
                          </div>
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
                          <Checkbox
                            checked={variant.lowStockAlert}
                            onCheckedChange={(checked) => updateLocalVariant(variant.id, 'lowStockAlert', !!checked)}
                          />
                        </TableCell>
                        {/* Actions */}
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {variant.isDirty && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveVariant(variant)}
                                disabled={savingIds.has(variant.id)}
                              >
                                {savingIds.has(variant.id) ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 text-[var(--status-success)]" />
                                )}
                              </Button>
                            )}
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
                      </TableRow>
                        {expandedVariants.has(variant.id) && variant.stockByLocation.length > 0 && (
                          <TableRow className="bg-[var(--bg-secondary)]">
                            <TableCell colSpan={optionTypes.length + 7} className="p-0">
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
      />
    </>
  )
}
