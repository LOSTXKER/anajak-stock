'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { ShoppingCart, ArrowLeft, Loader2, Plus, Trash2, Calculator, FileText, ListPlus } from 'lucide-react'
import { BulkAddModal, BulkAddResult, BulkAddVariant } from '@/components/bulk-add-modal'
import { createPO, getSuppliers } from '@/actions/po'
import { getProducts } from '@/actions/products'
import { getPR } from '@/actions/pr'
import { toast } from 'sonner'
import { VatType } from '@/generated/prisma'
import type { ProductWithRelations } from '@/types'
import type { Supplier } from '@/generated/prisma'
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

const vatOptions = [
  { value: 'NO_VAT', label: 'ไม่มี VAT' },
  { value: 'EXCLUDED', label: 'ยังไม่รวม VAT' },
  { value: 'INCLUDED', label: 'รวม VAT แล้ว' },
]

export default function NewPOPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prId = searchParams.get('prId')
  const initialSupplierId = searchParams.get('supplierId')

  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(!!prId)
  const [supplierId, setSupplierId] = useState(initialSupplierId || '')
  const [vatType, setVatType] = useState<VatType>(VatType.NO_VAT)
  const [vatRate, setVatRate] = useState(7)
  const [eta, setEta] = useState('')
  const [terms, setTerms] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<POLine[]>([])
  const [linkedPR, setLinkedPR] = useState<{ prNumber: string } | null>(null)

  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)
  const [loadingVariantFor, setLoadingVariantFor] = useState<string | null>(null)
  const [loadedVariants, setLoadedVariants] = useState<Record<string, Variant[]>>({})

  useEffect(() => {
    async function loadData() {
      setIsLoadingProducts(true)
      const [productsResult, suppliersData] = await Promise.all([
        getProducts({ limit: 1000 }),
        getSuppliers(),
      ])
      setProducts(productsResult.items.map(p => ({
        ...p,
        hasVariants: p.hasVariants || false,
        variants: undefined,
      })))
      setSuppliers(suppliersData)
      setIsLoadingProducts(false)

      // If prId is provided, load PR data and pre-fill lines
      if (prId) {
        const pr = await getPR(prId)
        if (pr) {
          setLinkedPR({ prNumber: pr.prNumber })
          setNote(`อ้างอิงจาก ${pr.prNumber}${pr.note ? ` - ${pr.note}` : ''}`)
          
          // Collect product IDs that have variants to load
          const productIdsWithVariants = new Set<string>()
          pr.lines.forEach((line) => {
            const product = productsResult.items.find(p => p.id === line.productId)
            if (product?.hasVariants) {
              productIdsWithVariants.add(line.productId)
            }
          })
          
          // Load variants for products that have variants
          const variantsToLoad: Record<string, Variant[]> = {}
          await Promise.all(
            Array.from(productIdsWithVariants).map(async (productId) => {
              try {
                const response = await fetch(`/api/products/${productId}/variants`)
                if (response.ok) {
                  const data = await response.json()
                  variantsToLoad[productId] = data.map((v: { 
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
                console.error(`Failed to load variants for product ${productId}:`, error)
              }
            })
          )
          
          // Set loaded variants state
          setLoadedVariants(variantsToLoad)
          
          // Pre-fill lines from PR
          const prLines: POLine[] = pr.lines.map((line) => {
            const product = productsResult.items.find(p => p.id === line.productId)
            
            // Get variant label from PR line data or loaded variants
            let variantLabel: string | undefined
            if (line.variantId) {
              // First try to get from PR line variant data (cast to include variant from API response)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const lineWithVariant = line as any
              const prVariant = lineWithVariant.variant as { optionValues?: { optionValue: { value: string } }[] } | null
              if (prVariant?.optionValues) {
                variantLabel = prVariant.optionValues.map(ov => ov.optionValue.value).join(' / ')
              } else {
                // Fallback to loaded variants
                const loadedVariant = variantsToLoad[line.productId]?.find(v => v.id === line.variantId)
                if (loadedVariant) {
                  variantLabel = loadedVariant.options.map(o => o.value).join(' / ')
                }
              }
            }
            
            return {
              id: Math.random().toString(36).substr(2, 9),
              productId: line.productId,
              variantId: line.variantId || undefined,
              productName: product?.name || line.product?.name,
              variantLabel,
              qty: Number(line.qty),
              unitPrice: Number(product?.lastCost || product?.standardCost || 0),
              note: line.note || undefined,
            }
          })
          setLines(prLines)
        }
        setIsInitializing(false)
      }
    }
    loadData()
  }, [prId])

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
    
    const newLines: POLine[] = selections.map(sel => ({
      id: Math.random().toString(36).substr(2, 9),
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

  function addLine() {
    setLines([
      ...lines,
      {
        id: Math.random().toString(36).substr(2, 9),
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

  const subtotal = lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.unitPrice), 0)
  const vatAmount = vatType === VatType.EXCLUDED ? subtotal * (vatRate / 100) : 0
  const total = subtotal + vatAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!supplierId) {
      toast.error('กรุณาเลือก Supplier')
      return
    }

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

    const result = await createPO({
      supplierId,
      prId: prId || undefined,
      vatType,
      vatRate,
      eta: eta ? new Date(eta) : undefined,
      terms,
      note,
      lines: validLines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        qty: Number(line.qty) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        note: line.note,
      })),
    })

    setIsLoading(false)

    if (result.success) {
      toast.success('สร้าง PO เรียบร้อยแล้ว')
      router.push('/po')
    } else {
      toast.error(result.error)
    }
  }

  const selectedSupplier = suppliers.find(s => s.id === supplierId)

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--text-muted)]">กำลังโหลดข้อมูลจาก PR...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={prId ? `/pr/${prId}` : '/purchasing'}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <PageHeader
            title="สร้างใบสั่งซื้อ (PO)"
            description="สร้าง Purchase Order สำหรับสั่งซื้อสินค้า"
            icon={<ShoppingCart className="w-6 h-6" />}
          />
        </div>
        {linkedPR && (
          <Badge className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
            <FileText className="w-3.5 h-3.5 mr-1" />
            อ้างอิงจาก {linkedPR.prNumber}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - PO Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูล Supplier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Supplier <span className="text-[var(--status-error)]">*</span></Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className={!supplierId ? 'border-[var(--status-error)]/50' : ''}>
                      <SelectValue placeholder="เลือก Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          <span className="font-mono text-xs text-[var(--text-muted)] mr-2">{supplier.code}</span>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedSupplier && (
                  <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
                    <div className="text-sm text-[var(--text-muted)]">ข้อมูลติดต่อ</div>
                    <div className="text-sm mt-1">
                      {selectedSupplier.contactName && <div>{selectedSupplier.contactName}</div>}
                      {selectedSupplier.phone && <div>{selectedSupplier.phone}</div>}
                      {selectedSupplier.email && <div>{selectedSupplier.email}</div>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">รายละเอียดการสั่งซื้อ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>กำหนดส่ง (ETA)</Label>
                    <Input
                      type="date"
                      value={eta}
                      onChange={(e) => setEta(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>เงื่อนไขการชำระเงิน</Label>
                    <Input
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      placeholder="เช่น 30 วัน, เงินสด"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ประเภท VAT</Label>
                    <Select value={vatType} onValueChange={(v) => setVatType(v as VatType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vatOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {vatType !== VatType.NO_VAT && (
                    <div className="space-y-2">
                      <Label>อัตรา VAT (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={vatRate}
                        onChange={(e) => setVatRate(Number(e.target.value))}
                      />
                    </div>
                  )}
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
                        <TableHead className="w-24">จำนวน</TableHead>
                        <TableHead className="w-32">ราคา/หน่วย</TableHead>
                        <TableHead className="w-32 text-right">รวม</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                              <ShoppingCart className="w-10 h-10 opacity-50" />
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
                              <TableCell className="text-right font-mono font-medium">
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
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  สรุปยอด
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">ยอดรวมก่อน VAT</span>
                    <span className="font-mono">฿{subtotal.toLocaleString()}</span>
                  </div>
                  {vatType !== VatType.NO_VAT && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">VAT ({vatRate}%)</span>
                      <span className="font-mono">฿{vatAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-[var(--border-default)] pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">ยอดรวมทั้งสิ้น</span>
                      <span className="text-xl font-bold text-[var(--accent-primary)] font-mono">
                        ฿{total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--border-default)] pt-4 space-y-3">
                  <Button
                    type="submit"
                    disabled={isLoading || !supplierId || lines.length === 0}
                    className="w-full"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                    สร้างใบสั่งซื้อ
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/po">ยกเลิก</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
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
