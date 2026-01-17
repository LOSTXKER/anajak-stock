'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeftRight, ArrowLeft, Loader2, Plus, Trash2, Save, Package, ArrowDown, ArrowUp, RefreshCw, CornerDownRight, ListPlus } from 'lucide-react'
import { BulkAddModal, BulkAddSelection, BulkAddVariant } from '@/components/bulk-add-modal'
import { getMovement, updateMovement } from '@/actions/movements'
import { getProducts } from '@/actions/products'
import { getLocations } from '@/actions/stock'
import { toast } from 'sonner'
import { MovementType } from '@/generated/prisma'
import type { ProductWithRelations, LocationWithWarehouse } from '@/types'
import { PageHeader } from '@/components/common'
import { CascadingVariantPicker } from '@/components/variants'

interface PageProps {
  params: Promise<{ id: string }>
}

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
  costPrice?: number
}

interface ProductWithVariants extends ProductWithRelations {
  hasVariants: boolean
  variants?: Variant[]
}

interface MovementLine {
  id: string
  productId: string
  variantId?: string
  productName?: string
  variantLabel?: string
  fromLocationId?: string
  toLocationId?: string
  qty: number
  unitCost: number
  note?: string
}

const typeConfig: Record<MovementType, { label: string; icon: React.ReactNode; color: string }> = {
  RECEIVE: { 
    label: 'รับเข้า', 
    icon: <ArrowDown className="w-4 h-4" />, 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
  },
  ISSUE: { 
    label: 'เบิกออก', 
    icon: <ArrowUp className="w-4 h-4" />, 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
  },
  TRANSFER: { 
    label: 'โอนย้าย', 
    icon: <ArrowLeftRight className="w-4 h-4" />, 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
  },
  ADJUST: { 
    label: 'ปรับยอด', 
    icon: <RefreshCw className="w-4 h-4" />, 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
  },
  RETURN: { 
    label: 'คืนของ', 
    icon: <CornerDownRight className="w-4 h-4" />, 
    color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
  },
}

export default function EditMovementPage(props: PageProps) {
  const params = use(props.params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [type, setType] = useState<MovementType>(MovementType.ISSUE)
  const [docNumber, setDocNumber] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [lines, setLines] = useState<MovementLine[]>([])

  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [locations, setLocations] = useState<LocationWithWarehouse[]>([])
  const [loadingVariantFor, setLoadingVariantFor] = useState<string | null>(null)
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const [movement, productsResult, locationsData] = await Promise.all([
          getMovement(params.id),
          getProducts({ limit: 1000 }),
          getLocations(),
        ])

        if (!movement) {
          toast.error('ไม่พบรายการ')
          router.push('/movements')
          return
        }

        if (movement.status !== 'DRAFT') {
          toast.error('ไม่สามารถแก้ไขรายการที่ไม่ใช่ Draft ได้')
          router.push(`/movements/${params.id}`)
          return
        }

        // Set form data
        setType(movement.type as MovementType)
        setDocNumber(movement.docNumber)
        setNote(movement.note || '')
        setReason(movement.reason || '')
        setProjectCode(movement.projectCode || '')
        setLines(movement.lines.map(line => ({
          id: line.id,
          productId: line.productId,
          variantId: line.variantId || undefined,
          productName: line.product.name,
          fromLocationId: line.fromLocationId || undefined,
          toLocationId: line.toLocationId || undefined,
          qty: Number(line.qty),
          unitCost: Number(line.unitCost),
          note: line.note || undefined,
        })))

        setProducts(productsResult.items.map(p => ({
          ...p,
          hasVariants: p.hasVariants || false,
          variants: undefined,
        })))
        setLocations(locationsData as LocationWithWarehouse[])
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [params.id, router])

  const loadVariantsForProduct = async (productId: string): Promise<Variant[]> => {
    setLoadingVariantFor(productId)
    try {
      const response = await fetch(`/api/products/${productId}/variants`)
      if (response.ok) {
        const variants = await response.json()
        return variants.map((v: { 
          id: string
          sku: string
          name: string | null
          costPrice?: number
          optionValues: { optionValue: { value: string; optionType: { name: string } } }[]
          stockBalances?: { qtyOnHand: number }[]
        }) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          options: v.optionValues?.map((ov) => ({
            optionName: ov.optionValue.optionType.name,
            value: ov.optionValue.value,
          })) || [],
          stock: v.stockBalances?.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0) || 0,
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
        }))
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    } finally {
      setLoadingVariantFor(null)
    }
    return []
  }

  // Bulk add handler - receives selections from modal
  function handleBulkAdd(selections: BulkAddSelection[]) {
    const newLines: MovementLine[] = selections.map(sel => ({
      id: `new-${Math.random().toString(36).substr(2, 9)}`,
      productId: sel.productId,
      variantId: sel.variantId,
      productName: sel.productName,
      variantLabel: sel.variantLabel,
      qty: 1,
      unitCost: sel.unitCost,
    }))
    
    setLines(prev => [...prev, ...newLines])
    setShowBulkAddModal(false)
    toast.success(`เพิ่ม ${newLines.length} รายการ`)
  }

  // Load variants for bulk add modal
  const loadVariantsForBulkAdd = async (productId: string): Promise<BulkAddVariant[]> => {
    try {
      const response = await fetch(`/api/products/${productId}/variants`)
      if (response.ok) {
        const variants = await response.json()
        return variants.map((v: { 
          id: string
          sku: string
          name: string | null
          costPrice?: number
          optionValues: { optionValue: { value: string; optionType: { name: string } } }[]
          stockBalances?: { qtyOnHand: number }[]
        }) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          options: v.optionValues?.map((ov) => ({
            optionName: ov.optionValue.optionType.name,
            value: ov.optionValue.value,
          })) || [],
          stock: v.stockBalances?.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0) || 0,
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
        }))
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    }
    return []
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: `new-${Math.random().toString(36).substr(2, 9)}`,
        productId: '',
        qty: 1,
        unitCost: 0,
      },
    ])
  }

  function removeLine(id: string) {
    setLines(lines.filter((line) => line.id !== id))
  }

  function updateLine(id: string, updates: Partial<MovementLine>) {
    setLines(
      lines.map((line) =>
        line.id === id ? { ...line, ...updates } : line
      )
    )
  }

  async function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const updates: Partial<MovementLine> = {
      productId,
      productName: product.name,
      unitCost: Number(product.lastCost || product.standardCost || 0),
      variantId: undefined,
      variantLabel: undefined,
    }

    if (product.hasVariants) {
      const variants = await loadVariantsForProduct(productId)
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, variants } : p
      ))
    }

    updateLine(lineId, updates)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (lines.length === 0) {
      toast.error('กรุณาเพิ่มรายการสินค้า')
      return
    }

    for (const line of lines) {
      if (!line.productId) {
        toast.error('กรุณาเลือกสินค้าทุกรายการ')
        return
      }
      const product = products.find(p => p.id === line.productId)
      if (product?.hasVariants && !line.variantId) {
        toast.error(`กรุณาเลือก variant สำหรับ ${product.name}`)
        return
      }
      if (type !== MovementType.ADJUST && line.qty <= 0) {
        toast.error('จำนวนต้องมากกว่า 0')
        return
      }
      if (line.qty === 0) {
        toast.error('จำนวนต้องไม่เป็น 0')
        return
      }
    }

    setIsLoading(true)

    const result = await updateMovement(params.id, {
      note,
      reason,
      projectCode,
      lines: lines.map((line) => ({
        id: line.id.startsWith('new-') ? undefined : line.id,
        productId: line.productId,
        variantId: line.variantId,
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        qty: line.qty,
        unitCost: line.unitCost,
        note: line.note,
      })),
    })

    setIsLoading(false)

    if (result.success) {
      toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      router.push(`/movements/${params.id}`)
    } else {
      toast.error(result.error)
    }
  }

  function getProductVariants(productId: string): Variant[] {
    const product = products.find(p => p.id === productId)
    return product?.variants || []
  }

  const currentType = typeConfig[type]

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/movements/${params.id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title={`แก้ไข ${docNumber}`}
          description="แก้ไขรายการเคลื่อนไหวสต๊อค"
          icon={<ArrowLeftRight className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Movement Type (Read-only) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3">
              ประเภท:
              <Badge className={currentType.color}>
                {currentType.icon}
                <span className="ml-1">{currentType.label}</span>
              </Badge>
              <span className="text-[var(--text-muted)] text-sm font-normal">(ไม่สามารถเปลี่ยนประเภทได้)</span>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Movement Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลเอกสาร</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>เหตุผล</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เหตุผลในการเคลื่อนไหว"
                />
              </div>
              <div className="space-y-2">
                <Label>รหัสโปรเจค / ออเดอร์</Label>
                <Input
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  placeholder="รหัสโปรเจค/ออเดอร์"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-[var(--accent-primary)] rounded-full" />
              <CardTitle className="text-base">รายการสินค้า</CardTitle>
              {lines.length > 0 && (
                <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
                  {lines.length} รายการ
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowBulkAddModal(true)}
                size="sm"
                variant="outline"
              >
                <ListPlus className="w-4 h-4 mr-1" />
                เพิ่มหลายรายการ
              </Button>
              <Button
                type="button"
                onClick={addLine}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มรายการ
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">สินค้า</TableHead>
                    <TableHead className="min-w-[200px]">ตัวเลือก (สี/ไซส์)</TableHead>
                    {(type === 'ISSUE' || type === 'TRANSFER') && (
                      <TableHead className="min-w-[150px]">จากโลเคชัน</TableHead>
                    )}
                    {(type === 'RECEIVE' || type === 'TRANSFER' || type === 'ADJUST') && (
                      <TableHead className="min-w-[150px]">ไปโลเคชัน</TableHead>
                    )}
                    <TableHead className="w-24">จำนวน</TableHead>
                    {type === 'RECEIVE' && (
                      <TableHead className="w-32">ต้นทุน</TableHead>
                    )}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                          <Package className="w-10 h-10 opacity-50" />
                          <p>ยังไม่มีรายการ</p>
                          <p className="text-sm">คลิก &quot;เพิ่มรายการ&quot; เพื่อเริ่มต้น</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => {
                      const product = products.find(p => p.id === line.productId)
                      const variants = getProductVariants(line.productId)
                      const showVariantSelect = product?.hasVariants

                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Select
                              value={line.productId}
                              onValueChange={(v) => handleProductChange(line.id, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="เลือกสินค้า" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs text-[var(--text-muted)]">{product.sku}</span>
                                      <span>{product.name}</span>
                                      {product.hasVariants && (
                                        <Badge variant="secondary" className="text-xs">Variants</Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {showVariantSelect ? (
                              loadingVariantFor === line.productId || variants.length === 0 ? (
                                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  กำลังโหลดตัวเลือก...
                                </div>
                              ) : (
                                <CascadingVariantPicker
                                  variants={variants}
                                  selectedVariantId={line.variantId}
                                  onSelect={(variant) => {
                                    if (variant) {
                                      updateLine(line.id, {
                                        variantId: variant.id,
                                        variantLabel: variant.options.map(o => o.value).join(' / '),
                                        unitCost: variant.costPrice || line.unitCost,
                                      })
                                    } else {
                                      updateLine(line.id, {
                                        variantId: undefined,
                                        variantLabel: undefined,
                                      })
                                    }
                                  }}
                                  showStock={true}
                                  placeholder="เลือก สี/ไซส์"
                                />
                              )
                            ) : (
                              <div className="text-[var(--text-muted)] text-sm">-</div>
                            )}
                          </TableCell>
                          {(type === 'ISSUE' || type === 'TRANSFER') && (
                            <TableCell>
                              <Select
                                value={line.fromLocationId || ''}
                                onValueChange={(v) => updateLine(line.id, { fromLocationId: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกโลเคชัน" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                      {loc.warehouse.name} - {loc.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          {(type === 'RECEIVE' || type === 'TRANSFER' || type === 'ADJUST') && (
                            <TableCell>
                              <Select
                                value={line.toLocationId || ''}
                                onValueChange={(v) => updateLine(line.id, { toLocationId: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกโลเคชัน" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                      {loc.warehouse.name} - {loc.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          <TableCell>
                            <Input
                              type="number"
                              min={type === 'ADJUST' ? undefined : 1}
                              value={line.qty}
                              onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) })}
                              className="w-20"
                            />
                            {type === 'ADJUST' && (
                              <span className="text-xs text-[var(--text-muted)] mt-1">
                                {line.qty >= 0 ? '+เพิ่ม' : '-ลด'}
                              </span>
                            )}
                          </TableCell>
                          {type === 'RECEIVE' && (
                            <TableCell>
                              <div className="flex items-center">
                                <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-2 py-1.5 text-sm">฿</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unitCost || ''}
                                  onChange={(e) => updateLine(line.id, { unitCost: Number(e.target.value) })}
                                  className="w-24 rounded-l-none"
                                />
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(line.id)}
                              className="text-[var(--status-error)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-light)]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href={`/movements/${params.id}`}>ยกเลิก</Link>
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>

      {/* Bulk Add Modal */}
      <BulkAddModal
        open={showBulkAddModal}
        onOpenChange={setShowBulkAddModal}
        products={products}
        existingProductIds={new Set(lines.filter(l => !l.variantId).map(l => l.productId))}
        existingVariantIds={new Set(lines.filter(l => l.variantId).map(l => l.variantId!))}
        onConfirm={handleBulkAdd}
        loadVariants={loadVariantsForBulkAdd}
        showVariants={true}
      />
    </div>
  )
}
