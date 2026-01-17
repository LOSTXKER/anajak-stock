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
import { BulkAddModal, BulkAddResult } from '@/components/bulk-add-modal'
import { createPR, submitPR } from '@/actions/pr'
import { getProducts } from '@/actions/products'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'
import { PageHeader } from '@/components/common'

interface PRLine {
  id: string
  productId: string
  productName?: string
  qty: number
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
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)

  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true)
      const result = await getProducts({ limit: 1000 })
      setProducts(result.items)
      setIsLoadingProducts(false)
    }
    loadProducts()
  }, [])

  // Bulk add handler - receives result from modal
  function handleBulkAdd(result: BulkAddResult) {
    const { selections } = result
    const newLines: PRLine[] = selections.map(sel => ({
      id: Math.random().toString(36).substr(2, 9),
      productId: sel.productId,
      productName: sel.productName,
      qty: 1,
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

  async function handleSubmit(e: React.FormEvent, andSubmit = false) {
    e.preventDefault()

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

    const result = await createPR({
      needByDate: needByDate ? new Date(needByDate) : undefined,
      priority,
      note,
      lines: validLines.map((line) => ({
        productId: line.productId,
        qty: line.qty,
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
    <div className="space-y-6 max-w-5xl mx-auto">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">สินค้า</TableHead>
                  <TableHead className="w-28">จำนวน</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                        <FileText className="w-10 h-10 opacity-50" />
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
                            updateLine(line.id, { productId: v, productName: product?.name })
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
                  ))
                )}
              </TableBody>
            </Table>
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
        existingProductIds={new Set(lines.map(l => l.productId))}
        onConfirm={handleBulkAdd}
        showVariants={false}
      />
    </div>
  )
}
