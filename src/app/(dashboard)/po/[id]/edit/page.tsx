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
import { BulkAddModal, BulkAddSelection } from '@/components/bulk-add-modal'
import { getPO, updatePO } from '@/actions/po'
import { getProducts } from '@/actions/products'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'
import { PageHeader } from '@/components/common'

interface PageProps {
  params: Promise<{ id: string }>
}

interface POLine {
  id: string
  productId: string
  productName?: string
  qty: number
  unitPrice: number
  note?: string
}

export default function EditPOPage(props: PageProps) {
  const params = use(props.params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  const [poNumber, setPONumber] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [eta, setEta] = useState('')
  const [terms, setTerms] = useState('')
  const [note, setNote] = useState('')
  const [vatType, setVatType] = useState('NO_VAT')
  const [vatRate, setVatRate] = useState(7)
  const [lines, setLines] = useState<POLine[]>([])
  
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const [po, productsResult] = await Promise.all([
          getPO(params.id),
          getProducts({ limit: 1000 }),
        ])

        if (!po) {
          toast.error('ไม่พบ PO')
          router.push('/purchasing')
          return
        }

        if (po.status !== 'DRAFT') {
          toast.error('ไม่สามารถแก้ไข PO ที่ไม่ใช่ Draft ได้')
          router.push(`/po/${params.id}`)
          return
        }

        // Set form data
        setPONumber(po.poNumber)
        setSupplierName(po.supplier.name)
        setEta(po.eta ? new Date(po.eta).toISOString().split('T')[0] : '')
        setTerms(po.terms || '')
        setNote(po.note || '')
        setVatType(po.vatType || 'NO_VAT')
        setVatRate(Number(po.vatRate) || 7)
        setLines(po.lines.map(line => ({
          id: line.id,
          productId: line.productId,
          productName: line.product.name,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          note: line.note || undefined,
        })))

        setProducts(productsResult.items)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [params.id, router])

  function addLine() {
    setLines([
      ...lines,
      {
        id: `new-${Math.random().toString(36).substr(2, 9)}`,
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

  function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    updateLine(lineId, {
      productId,
      productName: product.name,
      unitPrice: Number(product.lastCost || product.standardCost || 0),
    })
  }

  // Bulk add handler - receives selections from modal
  function handleBulkAdd(selections: BulkAddSelection[]) {
    const newLines: POLine[] = selections.map(sel => ({
      id: `new-${Math.random().toString(36).substr(2, 9)}`,
      productId: sel.productId,
      productName: sel.productName,
      qty: 1,
      unitPrice: sel.unitCost,
    }))
    
    setLines(prev => [...prev, ...newLines])
    setShowBulkAddModal(false)
    toast.success(`เพิ่ม ${newLines.length} รายการ`)
  }

  // Calculate totals
  const subtotal = lines.reduce((sum, line) => sum + (line.qty * line.unitPrice), 0)
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
      if (line.qty <= 0) {
        toast.error('จำนวนต้องมากกว่า 0')
        return
      }
    }

    setIsLoading(true)

    const result = await updatePO(params.id, {
      eta: eta ? new Date(eta) : undefined,
      terms,
      note,
      vatType: vatType as 'NO_VAT' | 'INCLUDED' | 'EXCLUDED',
      vatRate,
      lines: lines.map((line) => ({
        id: line.id.startsWith('new-') ? undefined : line.id,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/po/${params.id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title={`แก้ไข ${poNumber}`}
          description={`Supplier: ${supplierName}`}
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
                    <TableHead className="min-w-[300px]">สินค้า</TableHead>
                    <TableHead className="w-24">จำนวน</TableHead>
                    <TableHead className="w-32">ราคา/หน่วย</TableHead>
                    <TableHead className="w-32">รวม</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                          <Package className="w-10 h-10 opacity-50" />
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
                                  </div>
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
                              value={line.unitPrice}
                              onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                              className="w-24 rounded-l-none"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-right">
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
                  {/* Totals */}
                  {lines.length > 0 && (
                    <>
                      <TableRow className="bg-[var(--bg-secondary)]">
                        <TableCell colSpan={3} className="text-right font-medium">
                          ยอดรวม
                        </TableCell>
                        <TableCell className="font-mono text-right">
                          ฿{subtotal.toLocaleString()}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {vatType !== 'NO_VAT' && (
                        <TableRow className="bg-[var(--bg-secondary)]">
                          <TableCell colSpan={3} className="text-right font-medium">
                            VAT {vatRate}%
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            ฿{vatAmount.toLocaleString()}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-[var(--bg-secondary)]">
                        <TableCell colSpan={3} className="text-right font-bold">
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
        existingProductIds={new Set(lines.map(l => l.productId))}
        onConfirm={handleBulkAdd}
        showVariants={false}
      />
    </div>
  )
}
