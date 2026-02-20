'use client'

import { useState, useEffect } from 'react'
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
import { FileText, ArrowLeft, Loader2, Plus, Trash2, Send, Save, ListPlus } from 'lucide-react'
import { BulkAddModal, BulkAddResult, BulkAddVariant } from '@/components/bulk-add-modal'
import { createPR, submitPR } from '@/actions/pr'
import { getProducts } from '@/actions/products'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'
import { PageHeader } from '@/components/common'
import { CascadingVariantPicker } from '@/components/variants'

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

interface PRLine {
  id: string
  productId: string
  variantId?: string
  productName?: string
  variantLabel?: string
  qty: number | ''
  note?: string
}

const priorityOptions = [
  { value: 'LOW', label: 'ต่ำ', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'NORMAL', label: 'ปกติ', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  { value: 'HIGH', label: 'สูง', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  { value: 'URGENT', label: 'เร่งด่วน', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
]

export default function NewPRPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [needByDate, setNeedByDate] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<PRLine[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)
  const [loadingVariantFor, setLoadingVariantFor] = useState<string | null>(null)
  const [loadedVariants, setLoadedVariants] = useState<Record<string, Variant[]>>({})

  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true)
      const result = await getProducts({ limit: 1000 })
      setProducts(result.items.map(p => ({
        ...p,
        hasVariants: p.hasVariants || false,
        variants: undefined,
      })))
      setIsLoadingProducts(false)
    }
    loadProducts()
  }, [])

  // Load variants for a product
  const loadVariantsForProduct = async (productId: string): Promise<Variant[]> => {
    // Check if already loaded (including empty result)
    if (productId in loadedVariants) {
      return loadedVariants[productId]
    }
    
    setLoadingVariantFor(productId)
    try {
      const response = await fetch(`/api/products/${productId}/variants`)
      if (response.ok) {
        const data = await response.json()
        const variants: Variant[] = data.map((v: { 
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
        
        // Store in loadedVariants state
        setLoadedVariants(prev => ({ ...prev, [productId]: variants }))
        
        return variants
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    } finally {
      setLoadingVariantFor(null)
    }
    return []
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

  // Convert BulkAddVariant to Variant format
  function convertBulkAddVariants(variants: BulkAddVariant[]): Variant[] {
    return variants.map(v => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      options: v.options || [],
      stock: v.stock || 0,
      costPrice: v.costPrice,
    }))
  }

  // Bulk add handler - receives result from modal with selections and loaded variants
  function handleBulkAdd(result: BulkAddResult) {
    const { selections, loadedVariants: modalVariants } = result
    
    const newLines: PRLine[] = selections.map(sel => ({
      id: Math.random().toString(36).substr(2, 9),
      productId: sel.productId,
      variantId: sel.variantId,
      productName: sel.productName,
      variantLabel: sel.variantLabel,
      qty: '',
    }))
    
    setLines(prev => [...prev, ...newLines])
    setShowBulkAddModal(false)
    
    // Store loaded variants from modal into page state
    const convertedVariants: Record<string, Variant[]> = {}
    for (const [productId, variants] of Object.entries(modalVariants)) {
      convertedVariants[productId] = convertBulkAddVariants(variants)
    }
    setLoadedVariants(prev => ({ ...prev, ...convertedVariants }))
    
    toast.success(`เพิ่ม ${newLines.length} รายการ`)
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: Math.random().toString(36).substr(2, 9),
        productId: '',
        qty: '',
      },
    ])
  }

  function removeLine(id: string) {
    setLines(lines.filter((line) => line.id !== id))
  }

  function updateLine(id: string, updates: Partial<PRLine>) {
    setLines(
      lines.map((line) =>
        line.id === id ? { ...line, ...updates } : line
      )
    )
  }

  async function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const updates: Partial<PRLine> = {
      productId,
      productName: product.name,
      variantId: undefined,
      variantLabel: undefined,
    }

    updateLine(lineId, updates)

    // Load variants if needed
    if (product.hasVariants) {
      await loadVariantsForProduct(productId)
    }
  }

  function getProductVariants(productId: string): Variant[] {
    // Check if loaded in loadedVariants state
    if (productId in loadedVariants) {
      return loadedVariants[productId]
    }
    // Fallback to products state
    const product = products.find(p => p.id === productId)
    return product?.variants || []
  }

  async function handleSubmit(e: React.FormEvent, andSubmit = false) {
    e.preventDefault()

    if (lines.length === 0) {
      toast.error('กรุณาเพิ่มรายการสินค้า')
      return
    }

    const validLines = lines.filter((line) => line.productId && Number(line.qty) > 0)
    if (validLines.length === 0) {
      toast.error('กรุณาเลือกสินค้าและระบุจำนวน')
      return
    }

    // Validate variant selection for products with variants
    for (const line of validLines) {
      const product = products.find(p => p.id === line.productId)
      if (product?.hasVariants && !line.variantId) {
        toast.error(`กรุณาเลือกตัวเลือก (สี/ไซส์) สำหรับ "${product.name}"`)
        return
      }
    }

    setIsLoading(true)

    const result = await createPR({
      needByDate: needByDate ? new Date(needByDate) : undefined,
      priority,
      note,
      lines: validLines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        qty: Number(line.qty) || 0,
        note: line.note,
      })),
    })

    if (result.success && andSubmit) {
      await submitPR(result.data.id)
    }

    setIsLoading(false)

    if (result.success) {
      toast.success(andSubmit ? 'สร้างและส่ง PR เรียบร้อยแล้ว' : 'สร้าง PR เรียบร้อยแล้ว')
      router.push('/pr')
    } else {
      toast.error(result.error)
    }
  }

  const selectedPriority = priorityOptions.find(p => p.value === priority)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pr">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="สร้างใบขอซื้อ (PR)"
          description="สร้าง Purchase Requisition เพื่อขออนุมัติซื้อสินค้า"
          icon={<FileText className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* PR Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลใบขอซื้อ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ต้องการภายในวันที่</Label>
                <Input
                  type="date"
                  value={needByDate}
                  onChange={(e) => setNeedByDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ความสำคัญ</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue>
                      {selectedPriority && (
                        <div className="flex items-center gap-2">
                          <Badge className={selectedPriority.color}>{selectedPriority.label}</Badge>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Badge className={opt.color}>{opt.label}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ / เหตุผลในการขอซื้อ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ระบุเหตุผลในการขอซื้อ..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-[var(--accent-primary)] rounded-full" />
              <CardTitle className="text-base">รายการสินค้าที่ต้องการ</CardTitle>
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
                disabled={isLoadingProducts}
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
                    <TableHead className="w-28">จำนวน</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                          <FileText className="w-10 h-10 opacity-50" />
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
                              disabled={isLoadingProducts}
                            >
                              <SelectTrigger>
                                {isLoadingProducts ? (
                                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    กำลังโหลด...
                                  </span>
                                ) : (
                                  <SelectValue placeholder="เลือกสินค้า" />
                                )}
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
                              loadingVariantFor === line.productId ? (
                                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  กำลังโหลดตัวเลือก...
                                </div>
                              ) : variants.length === 0 ? (
                                <div className="text-sm text-[var(--text-muted)]">ไม่พบตัวเลือก</div>
                              ) : (
                                <CascadingVariantPicker
                                  variants={variants}
                                  selectedVariantId={line.variantId}
                                  onSelect={(variant) => {
                                    if (variant) {
                                      updateLine(line.id, {
                                        variantId: variant.id,
                                        variantLabel: variant.options.map(o => o.value).join(' / '),
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
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={line.qty}
                              onChange={(e) => updateLine(line.id, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.note || ''}
                              onChange={(e) => updateLine(line.id, { note: e.target.value })}
                              placeholder="หมายเหตุ"
                            />
                          </TableCell>
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
            <Link href="/pr">ยกเลิก</Link>
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            บันทึกฉบับร่าง
          </Button>
          <Button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            บันทึกและส่งอนุมัติ
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
