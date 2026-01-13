'use client'

import { useState, useCallback } from 'react'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Layers, Pencil, Trash2, ChevronDown, ChevronRight, Warehouse, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateVariant, deleteVariant } from '@/actions/variants'
import { useRouter } from 'next/navigation'

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
  variants: Variant[]
}

// Local state for inline editing
interface EditableVariant extends Variant {
  isEditing?: boolean
  isDirty?: boolean
}

export function VariantsSection({ productId, variants: initialVariants }: VariantsSectionProps) {
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

  return (
    <>
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
              SKU ({variants.length})
            </CardTitle>
            {hasDirtyVariants && (
              <Button onClick={saveAllChanges} size="sm">
                <Save className="w-4 h-4 mr-2" />
                บันทึกทั้งหมด
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>ราคาทุน</TableHead>
                  <TableHead>ราคาขาย</TableHead>
                  <TableHead>สต๊อค</TableHead>
                  <TableHead>จุดสั่งซื้อ</TableHead>
                  <TableHead className="text-center">แจ้งเตือน</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <Collapsible key={variant.id} asChild>
                    <>
                      <TableRow className={variant.isDirty ? 'bg-[var(--status-warning)]/5' : ''}>
                        <TableCell>
                          {variant.stockByLocation.length > 0 && (
                            <CollapsibleTrigger asChild>
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
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={variant.name || variant.options.map(o => o.value).join(', ')}
                            onChange={(e) => updateLocalVariant(variant.id, 'name', e.target.value)}
                            className="h-8 w-32"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {variant.sku}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.costPrice}
                            onChange={(e) => updateLocalVariant(variant.id, 'costPrice', Number(e.target.value))}
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.sellingPrice}
                            onChange={(e) => updateLocalVariant(variant.id, 'sellingPrice', Number(e.target.value))}
                            className="h-8 w-24"
                          />
                        </TableCell>
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
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={variant.reorderPoint}
                            onChange={(e) => updateLocalVariant(variant.id, 'reorderPoint', Number(e.target.value))}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={variant.lowStockAlert}
                            onCheckedChange={(checked) => updateLocalVariant(variant.id, 'lowStockAlert', !!checked)}
                          />
                        </TableCell>
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
                          <TableCell colSpan={9} className="p-0">
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
                    </>
                  </Collapsible>
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
    </>
  )
}
