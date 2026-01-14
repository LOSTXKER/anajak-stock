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
import { FileText, ArrowLeft, Loader2, Plus, Trash2, Save, Package } from 'lucide-react'
import { getPR, updatePR } from '@/actions/pr'
import { getProducts } from '@/actions/products'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'
import { PageHeader } from '@/components/common'

interface PageProps {
  params: Promise<{ id: string }>
}

interface PRLine {
  id: string
  productId: string
  productName?: string
  qty: number
  note?: string
}

const priorityOptions = [
  { value: 'LOW', label: 'ต่ำ' },
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'MEDIUM', label: 'ปานกลาง' },
  { value: 'HIGH', label: 'สูง' },
  { value: 'URGENT', label: 'เร่งด่วน' },
]

export default function EditPRPage(props: PageProps) {
  const params = use(props.params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  const [prNumber, setPrNumber] = useState('')
  const [needByDate, setNeedByDate] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [lines, setLines] = useState<PRLine[]>([])
  
  const [products, setProducts] = useState<ProductWithRelations[]>([])

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const [pr, productsResult] = await Promise.all([
          getPR(params.id),
          getProducts({ limit: 1000 }),
        ])

        if (!pr) {
          toast.error('ไม่พบ PR')
          router.push('/purchasing')
          return
        }

        if (pr.status !== 'DRAFT') {
          toast.error('ไม่สามารถแก้ไข PR ที่ไม่ใช่ Draft ได้')
          router.push(`/pr/${params.id}`)
          return
        }

        // Set form data
        setPrNumber(pr.prNumber)
        setNeedByDate(pr.needByDate ? new Date(pr.needByDate).toISOString().split('T')[0] : '')
        setNote(pr.note || '')
        setPriority(pr.priority || 'NORMAL')
        setLines(pr.lines.map(line => ({
          id: line.id,
          productId: line.productId,
          productName: line.product.name,
          qty: Number(line.qty),
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

  function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    updateLine(lineId, {
      productId,
      productName: product.name,
    })
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
      if (line.qty <= 0) {
        toast.error('จำนวนต้องมากกว่า 0')
        return
      }
    }

    setIsLoading(true)

    const result = await updatePR(params.id, {
      needByDate: needByDate ? new Date(needByDate) : undefined,
      note,
      priority,
      lines: lines.map((line) => ({
        id: line.id.startsWith('new-') ? undefined : line.id,
        productId: line.productId,
        qty: line.qty,
        note: line.note,
      })),
    })

    setIsLoading(false)

    if (result.success) {
      toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      router.push(`/pr/${params.id}`)
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
          <Link href={`/pr/${params.id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title={`แก้ไข ${prNumber}`}
          description="แก้ไขใบขอซื้อ"
          icon={<FileText className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* PR Info */}
        <Card className="mb-6">
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
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
                placeholder="ระบุเหตุผลหรือรายละเอียดเพิ่มเติม..."
                rows={3}
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
            <Button
              type="button"
              onClick={addLine}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มรายการ
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">สินค้า</TableHead>
                    <TableHead className="w-32">จำนวน</TableHead>
                    <TableHead className="min-w-[200px]">หมายเหตุ</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
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
                            className="w-24"
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
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href={`/pr/${params.id}`}>ยกเลิก</Link>
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
    </div>
  )
}
