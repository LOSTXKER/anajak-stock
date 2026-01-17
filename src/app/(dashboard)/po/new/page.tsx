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
import { BulkAddModal, BulkAddResult } from '@/components/bulk-add-modal'
import { createPO, getSuppliers } from '@/actions/po'
import { getProducts } from '@/actions/products'
import { getPR } from '@/actions/pr'
import { toast } from 'sonner'
import { VatType } from '@/generated/prisma'
import type { ProductWithRelations } from '@/types'
import type { Supplier } from '@/generated/prisma'
import { PageHeader } from '@/components/common'

interface POLine {
  id: string
  productId: string
  productName?: string
  qty: number
  unitPrice: number
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

  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)

  useEffect(() => {
    async function loadData() {
      setIsLoadingProducts(true)
      const [productsResult, suppliersData] = await Promise.all([
        getProducts({ limit: 1000 }),
        getSuppliers(),
      ])
      setProducts(productsResult.items)
      setSuppliers(suppliersData)
      setIsLoadingProducts(false)

      // If prId is provided, load PR data and pre-fill lines
      if (prId) {
        const pr = await getPR(prId)
        if (pr) {
          setLinkedPR({ prNumber: pr.prNumber })
          setNote(`อ้างอิงจาก ${pr.prNumber}${pr.note ? ` - ${pr.note}` : ''}`)
          
          // Pre-fill lines from PR
          const prLines: POLine[] = pr.lines.map((line) => {
            const product = productsResult.items.find(p => p.id === line.productId)
            return {
              id: Math.random().toString(36).substr(2, 9),
              productId: line.productId,
              productName: product?.name || line.product?.name,
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

  // Bulk add handler - receives result from modal
  function handleBulkAdd(result: BulkAddResult) {
    const { selections } = result
    const newLines: POLine[] = selections.map(sel => ({
      id: Math.random().toString(36).substr(2, 9),
      productId: sel.productId,
      productName: sel.productName,
      qty: 1,
      unitPrice: sel.unitCost,
    }))
    
    setLines(prev => [...prev, ...newLines])
    setShowBulkAddModal(false)
    toast.success(`เพิ่ม ${newLines.length} รายการ`)
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: Math.random().toString(36).substr(2, 9),
        productId: '',
        qty: 1,
        unitPrice: 0,
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

  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
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

    const validLines = lines.filter((line) => line.productId && line.qty > 0)
    if (validLines.length === 0) {
      toast.error('กรุณาเลือกสินค้าและระบุจำนวน')
      return
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
        qty: line.qty,
        unitPrice: line.unitPrice,
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
    <div className="space-y-6 max-w-5xl mx-auto">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">สินค้า</TableHead>
                      <TableHead className="w-24">จำนวน</TableHead>
                      <TableHead className="w-32">ราคา/หน่วย</TableHead>
                      <TableHead className="w-32 text-right">รวม</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                            <ShoppingCart className="w-10 h-10 opacity-50" />
                            <p>ยังไม่มีรายการ</p>
                            <p className="text-sm">คลิก &quot;เพิ่มรายการ&quot; เพื่อเริ่มต้น</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Select
                              value={line.productId}
                              onValueChange={(v) => {
                                const product = products.find((p) => p.id === v)
                                updateLine(line.id, {
                                  productId: v,
                                  productName: product?.name,
                                  unitPrice: Number(product?.lastCost || product?.standardCost || 0),
                                })
                              }}
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
                                    <span className="font-mono text-xs text-[var(--text-muted)] mr-2">{product.sku}</span>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={line.qty}
                              onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) })}
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
                                value={line.unitPrice || ''}
                                onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                                className="w-24 rounded-l-none"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            ฿{(line.qty * line.unitPrice).toLocaleString()}
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
                      ))
                    )}
                  </TableBody>
                </Table>
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
        existingProductIds={new Set(lines.map(l => l.productId))}
        onConfirm={handleBulkAdd}
        showVariants={false}
      />
    </div>
  )
}
