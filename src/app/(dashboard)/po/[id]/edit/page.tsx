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
import { ShoppingCart, ArrowLeft, Loader2, Plus, Trash2, Save, Package, ListPlus } from 'lucide-react'
import { BulkAddModal, BulkAddResult, BulkAddVariant } from '@/components/bulk-add-modal'
import { getPO, updatePO, getSuppliers } from '@/actions/po'
import { getProducts } from '@/actions/products'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'
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

interface POLine {
  id: string
  productId: string
  variantId?: string
  productName?: string
  variantLabel?: string
  qty: number | ''
  unitPrice: number | ''
  note?: string
}

interface Supplier {
  id: string
  name: string
  code?: string
}

export default function EditPOPage(props: PageProps) {
  const params = use(props.params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  const [poNumber, setPONumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [eta, setEta] = useState('')
  const [terms, setTerms] = useState('')
  const [note, setNote] = useState('')
  const [vatType, setVatType] = useState('NO_VAT')
  const [vatRate, setVatRate] = useState(7)
  const [lines, setLines] = useState<POLine[]>([])
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)
  const [loadingVariantFor, setLoadingVariantFor] = useState<string | null>(null)
  const [loadedVariants, setLoadedVariants] = useState<Record<string, Variant[]>>({})

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const [po, productsResult, suppliersResult] = await Promise.all([
          getPO(params.id),
          getProducts({ limit: 1000 }),
          getSuppliers(),
        ])

        if (!po) {
          toast.error('ไม่พบ PO')
          router.push('/purchasing')
          return
        }

        // Allow editing for DRAFT and REJECTED status (can be resubmitted for approval)
        if (po.status !== 'DRAFT' && po.status !== 'REJECTED') {
          toast.error('ไม่สามารถแก้ไข PO ที่ส่งอนุมัติหรือดำเนินการแล้วได้')
          router.push(`/po/${params.id}`)
          return
        }

        // Set suppliers
        setSuppliers(suppliersResult || [])

        // Set form data
        setPONumber(po.poNumber)
        setSupplierId(po.supplierId)
        setEta(po.eta ? new Date(po.eta).toISOString().split('T')[0] : '')
        setTerms(po.terms || '')
        setNote(po.note || '')
        setVatType(po.vatType || 'NO_VAT')
        setVatRate(Number(po.vatRate) || 7)
        
        // Build variant label from existing data
        setLines(po.lines.map(line => {
          // Build variant label from optionValues if variant exists
          let variantLabel: string | undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lineWithVariant = line as any
          if (lineWithVariant.variant?.optionValues) {
            variantLabel = lineWithVariant.variant.optionValues
              .map((ov: { optionValue: { value: string } }) => ov.optionValue.value)
              .join(' / ')
          }
          
          return {
            id: line.id,
            productId: line.productId,
            variantId: lineWithVariant.variantId || undefined,
            productName: line.product.name,
            variantLabel,
            qty: Number(line.qty),
            unitPrice: Number(line.unitPrice),
            note: line.note || undefined,
          }
        }))

        setProducts(productsResult.items.map(p => ({
          ...p,
          hasVariants: p.hasVariants || false,
          variants: undefined,
        })))
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [params.id, router])

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

  function addLine() {
    setLines([
      ...lines,
      {
        id: `new-${Math.random().toString(36).substr(2, 9)}`,
        productId: '',
        qty: '',
        unitPrice: '',
      },
    ])
  }

  function removeLine(id: string) {
    setLines(lines.filter((line) => line.id !== id))
  }

  function updateLine(id: string, updates: Partial<POLine>) {
    setLines(
      lines.map((line) =>
        line.id === id ? { ...line, ...updates } : line
      )
    )
  }

  async function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const updates: Partial<POLine> = {
      productId,
      productName: product.name,
      unitPrice: Number(product.lastCost || product.standardCost) || '',
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

  // Bulk add handler - receives result from modal with selections and loaded variants
  function handleBulkAdd(result: BulkAddResult) {
    const { selections, loadedVariants: modalVariants } = result
    
    const newLines: POLine[] = selections.map(sel => ({
      id: `new-${Math.random().toString(36).substr(2, 9)}`,
      productId: sel.productId,
      variantId: sel.variantId,
      productName: sel.productName,
      variantLabel: sel.variantLabel,
      qty: '',
      unitPrice: sel.unitCost,
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

  // Calculate totals
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.qty) * Number(line.unitPrice)), 0)
  const vatAmount = vatType === 'INCLUDED' || vatType === 'EXCLUDED' 
    ? subtotal * (vatRate / 100) 
    : 0
  const total = vatType === 'EXCLUDED' ? subtotal + vatAmount : subtotal

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
      // Validate variant selection for products with variants
      const product = products.find(p => p.id === line.productId)
      if (product?.hasVariants && !line.variantId) {
        toast.error(`กรุณาเลือกตัวเลือก (สี/ไซส์) สำหรับ "${product.name}"`)
        return
      }
      if (Number(line.qty) <= 0) {
        toast.error('จำนวนต้องมากกว่า 0')
        return
      }
    }

    setIsLoading(true)

    const result = await updatePO(params.id, {
      supplierId,
      eta: eta ? new Date(eta) : undefined,
      terms,
      note,
      vatType: vatType as 'NO_VAT' | 'INCLUDED' | 'EXCLUDED',
      vatRate,
      lines: lines.map((line) => ({
        id: line.id.startsWith('new-') ? undefined : line.id,
        productId: line.productId,
        variantId: line.variantId,
        qty: Number(line.qty) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        note: line.note,
      })),
    })

    setIsLoading(false)

    if (result.success) {
      toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      router.push(`/po/${params.id}`)
    } else {
      toast.error(result.error)
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/po/${params.id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title={`แก้ไข ${poNumber}`}
          icon={<ShoppingCart className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* PO Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลใบสั่งซื้อ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.code ? `[${supplier.code}] ` : ''}{supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>คาดว่าจะได้รับ (ETA)</Label>
                <Input
                  type="date"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ประเภท VAT</Label>
                <Select value={vatType} onValueChange={setVatType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_VAT">ไม่มี VAT</SelectItem>
                    <SelectItem value="INCLUDED">รวม VAT แล้ว</SelectItem>
                    <SelectItem value="EXCLUDED">ยังไม่รวม VAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {vatType !== 'NO_VAT' && (
                <div className="space-y-2">
                  <Label>VAT %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>เงื่อนไขการชำระเงิน</Label>
              <Input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="เช่น 30 วัน, เงินสด"
              />
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
                    <TableHead className="w-24">จำนวน</TableHead>
                    <TableHead className="w-32">ราคา/หน่วย</TableHead>
                    <TableHead className="w-32">รวม</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
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
                              loadingVariantFor === line.productId ? (
                                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  กำลังโหลดตัวเลือก...
                                </div>
                              ) : variants.length === 0 && !line.variantId ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadVariantsForProduct(line.productId)}
                                >
                                  โหลดตัวเลือก
                                </Button>
                              ) : variants.length === 0 && line.variantId ? (
                                <div className="text-sm">
                                  {line.variantLabel || 'กำลังโหลด...'}
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
                                        unitPrice: variant.costPrice || line.unitPrice,
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
                            <div className="flex items-center">
                              <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-2 py-1.5 text-sm">฿</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(e) => updateLine(line.id, { unitPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                                className="w-24 rounded-l-none"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            ฿{(Number(line.qty) * Number(line.unitPrice)).toLocaleString()}
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
                  {/* Totals */}
                  {lines.length > 0 && (
                    <>
                      <TableRow className="bg-[var(--bg-secondary)]">
                        <TableCell colSpan={4} className="text-right font-medium">
                          ยอดรวม
                        </TableCell>
                        <TableCell className="font-mono text-right">
                          ฿{subtotal.toLocaleString()}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {vatType !== 'NO_VAT' && (
                        <TableRow className="bg-[var(--bg-secondary)]">
                          <TableCell colSpan={4} className="text-right font-medium">
                            VAT {vatRate}%
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            ฿{vatAmount.toLocaleString()}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-[var(--bg-secondary)]">
                        <TableCell colSpan={4} className="text-right font-bold">
                          รวมทั้งสิ้น
                        </TableCell>
                        <TableCell className="font-mono text-right font-bold text-[var(--accent-primary)] text-lg">
                          ฿{total.toLocaleString()}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href={`/po/${params.id}`}>ยกเลิก</Link>
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
