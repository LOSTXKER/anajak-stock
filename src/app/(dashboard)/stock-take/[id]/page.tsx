'use client'

import { useState, useEffect, use, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  Save,
  AlertTriangle,
  Loader2,
  Warehouse,
  Package,
  TrendingUp,
  TrendingDown,
  Scan,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getStockTake,
  startStockTake,
  updateStockTakeLines,
  completeStockTake,
  approveStockTake,
  cancelStockTake,
} from '@/actions/stock-take'
import { StatCard } from '@/components/common'
import { BarcodeInput, useBarcodeScanner } from '@/components/barcode-scanner'
import { stockTakeStatusConfig } from '@/lib/status-config'
import { StockTakeStatus } from '@/generated/prisma'

interface StockTakeData {
  id: string
  code: string
  status: string
  note: string | null
  createdAt: Date
  completedAt: Date | null
  approvedAt: Date | null
  warehouse: { id: string; name: string; code: string }
  countedBy: { id: string; name: string } | null
  approvedBy: { id: string; name: string } | null
  lines: Array<{
    id: string
    productId: string
    variantId: string | null
    locationId: string
    systemQty: number
    countedQty: number | null
    variance: number | null
    note: string | null
    product: { id: string; sku: string; name: string; category: { name: string } | null }
    variant: { 
      id: string
      sku: string
      name: string | null
      optionValues?: Array<{
        optionValue: {
          value: string
          optionType: { name: string }
        }
      }>
    } | null
    location: { id: string; code: string; name: string }
  }>
}

interface LineEdit {
  countedQty: number | null
  note: string
}

export default function StockTakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [stockTake, setStockTake] = useState<StockTakeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lineEdits, setLineEdits] = useState<Record<string, LineEdit>>({})
  const [showBarcodeInput, setShowBarcodeInput] = useState(false)
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null)
  const lineInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Handle barcode scan - find product and focus on count input
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!stockTake || stockTake.status !== 'IN_PROGRESS') {
      toast.error('ไม่สามารถสแกนได้ในสถานะนี้')
      return
    }

    // Find line matching the barcode (match SKU or product barcode)
    const matchedLine = stockTake.lines.find(line => 
      line.product.sku.toLowerCase() === barcode.toLowerCase() ||
      line.variant?.sku.toLowerCase() === barcode.toLowerCase()
    )

    if (!matchedLine) {
      toast.error(`ไม่พบสินค้า "${barcode}" ในรายการตรวจนับ`)
      return
    }

    // Highlight and focus on the matched line
    setHighlightedLineId(matchedLine.id)
    toast.success(`พบ: ${matchedLine.product.name}`)
    
    // Focus on the input after a short delay
    setTimeout(() => {
      const inputRef = lineInputRefs.current[matchedLine.id]
      if (inputRef) {
        inputRef.focus()
        inputRef.select()
      }
    }, 100)

    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedLineId(null)
    }, 3000)
  }, [stockTake])

  // USB Scanner hook
  useBarcodeScanner(handleBarcodeScan, stockTake?.status === 'IN_PROGRESS' && !showBarcodeInput)

  const loadData = async () => {
    const result = await getStockTake(id)
    if (result.success) {
      const data = result.data as unknown as StockTakeData
      setStockTake({
        ...data,
        lines: data.lines.map(l => ({
          ...l,
          systemQty: Number(l.systemQty),
          countedQty: l.countedQty !== null ? Number(l.countedQty) : null,
          variance: l.variance !== null ? Number(l.variance) : null,
        })),
      })
      // Initialize line edits
      const edits: Record<string, LineEdit> = {}
      for (const line of data.lines) {
        edits[line.id] = {
          countedQty: line.countedQty !== null ? Number(line.countedQty) : null,
          note: line.note || '',
        }
      }
      setLineEdits(edits)
    } else {
      toast.error(result.error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleStart = async () => {
    const result = await startStockTake(id)
    if (result.success) {
      toast.success('เริ่มนับสต๊อคแล้ว')
      loadData()
    } else {
      toast.error(result.error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const lines = Object.entries(lineEdits)
      .filter(([, edit]) => edit.countedQty !== null)
      .map(([lineId, edit]) => ({
        lineId,
        countedQty: edit.countedQty!,
        note: edit.note || undefined,
      }))

    const result = await updateStockTakeLines(id, lines)
    if (result.success) {
      toast.success('บันทึกสำเร็จ')
      loadData()
    } else {
      toast.error(result.error)
    }
    setIsSaving(false)
  }

  const handleComplete = async () => {
    const result = await completeStockTake(id)
    if (result.success) {
      toast.success('นับเสร็จสมบูรณ์')
      loadData()
    } else {
      toast.error(result.error)
    }
  }

  const handleApprove = async () => {
    const result = await approveStockTake(id)
    if (result.success) {
      toast.success('อนุมัติและปรับยอดสำเร็จ')
      loadData()
    } else {
      toast.error(result.error)
    }
  }

  const handleCancel = async () => {
    const result = await cancelStockTake(id)
    if (result.success) {
      toast.success('ยกเลิกใบตรวจนับแล้ว')
      router.push('/stock-take')
    } else {
      toast.error(result.error)
    }
  }

  const updateLineEdit = (lineId: string, field: keyof LineEdit, value: number | string | null) => {
    setLineEdits(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value,
      },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  if (!stockTake) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-[var(--status-error)]">
          ไม่พบใบตรวจนับ
        </CardContent>
      </Card>
    )
  }

  const totalLines = stockTake.lines.length
  const countedLines = stockTake.lines.filter(l => l.countedQty !== null).length
  const linesWithVariance = stockTake.lines.filter(l => l.variance !== null && l.variance !== 0)
  const statusInfo = stockTakeStatusConfig[stockTake.status as StockTakeStatus] || stockTakeStatusConfig.DRAFT

  return (
    <div className="space-y-6">
      {/* Action Required Banner */}
      {statusInfo.type === 'action_required' && statusInfo.actionHint && (
        <div className="bg-[var(--status-warning-light)] border border-[var(--status-warning)]/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0" />
          <div>
            <p className="font-medium text-[var(--status-warning)]">ต้องดำเนินการ</p>
            <p className="text-sm text-[var(--text-secondary)]">{statusInfo.actionHint}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stock-take">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">ใบตรวจนับ {stockTake.code}</h1>
              <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.label}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-muted)] mt-1">
              <Warehouse className="w-4 h-4" />
              {stockTake.warehouse.name} ({stockTake.warehouse.code})
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="รายการทั้งหมด"
          value={totalLines}
          icon={Package}
          variant="info"
        />
        <StatCard
          title="นับแล้ว"
          value={countedLines}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="ยังไม่ได้นับ"
          value={totalLines - countedLines}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="มีผลต่าง"
          value={linesWithVariance.length}
          icon={AlertTriangle}
          variant={linesWithVariance.length > 0 ? 'error' : 'default'}
        />
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            {stockTake.status === 'DRAFT' && (
              <>
                <Button onClick={handleStart}>
                  <Play className="w-4 h-4 mr-2" />
                  เริ่มนับ
                </Button>
                <Button onClick={handleCancel} variant="outline" className="text-[var(--status-error)] border-[var(--status-error)]/50 hover:bg-[var(--status-error-light)]">
                  <XCircle className="w-4 h-4 mr-2" />
                  ยกเลิก
                </Button>
              </>
            )}
            {stockTake.status === 'IN_PROGRESS' && (
              <>
                <Button 
                  variant={showBarcodeInput ? 'default' : 'outline'}
                  onClick={() => setShowBarcodeInput(!showBarcodeInput)}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  สแกน Barcode
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  บันทึก
                </Button>
                <Button onClick={handleComplete} variant="secondary">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  นับเสร็จ
                </Button>
                <Button onClick={handleCancel} variant="outline" className="text-[var(--status-error)] border-[var(--status-error)]/50 hover:bg-[var(--status-error-light)]">
                  <XCircle className="w-4 h-4 mr-2" />
                  ยกเลิก
                </Button>
              </>
            )}
            {stockTake.status === 'COMPLETED' && (
              <>
                <Button onClick={handleApprove}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  อนุมัติและปรับยอด
                </Button>
                <Button onClick={handleCancel} variant="outline" className="text-[var(--status-error)] border-[var(--status-error)]/50 hover:bg-[var(--status-error-light)]">
                  <XCircle className="w-4 h-4 mr-2" />
                  ยกเลิก
                </Button>
              </>
            )}
          </div>

          {/* Barcode Scanner Input */}
          {showBarcodeInput && stockTake.status === 'IN_PROGRESS' && (
            <div className="bg-[var(--accent-light)]/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--accent-primary)]">
                <Scan className="w-4 h-4" />
                <span className="font-medium">สแกน Barcode เพื่อค้นหาสินค้า</span>
              </div>
              <BarcodeInput 
                onScan={handleBarcodeScan}
                placeholder="สแกน SKU หรือ Barcode แล้วกด Enter..."
              />
              <p className="text-xs text-[var(--text-muted)]">
                💡 สแกนแล้วระบบจะเลื่อนไปที่รายการนั้นให้กรอกจำนวน | USB Scanner ทำงานอัตโนมัติ
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-muted)]">ความคืบหน้าการนับ</span>
            <span className="font-medium">{Math.round((countedLines / totalLines) * 100)}%</span>
          </div>
          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-3">
            <div
              className="bg-[var(--accent-primary)] h-3 rounded-full transition-all"
              style={{ width: `${(countedLines / totalLines) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-sm text-[var(--text-muted)]">
            <span>{countedLines} นับแล้ว</span>
            <span>{totalLines - countedLines} เหลือ</span>
          </div>
        </CardContent>
      </Card>

      {/* Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการสินค้า
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {totalLines} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead className="text-right">ยอดในระบบ</TableHead>
                  <TableHead className="text-right">นับได้</TableHead>
                  <TableHead className="text-right">ผลต่าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockTake.lines.map((line) => {
                  const edit = lineEdits[line.id] || { countedQty: null, note: '' }
                  const variance = edit.countedQty !== null 
                    ? edit.countedQty - line.systemQty 
                    : line.variance
                  const isHighlighted = highlightedLineId === line.id
                  
                  // สร้างชื่อ variant จาก option values
                  const variantName = line.variant?.optionValues
                    ?.map((ov) => ov.optionValue.value)
                    .join(', ') || line.variant?.name

                  return (
                    <TableRow 
                      key={line.id}
                      className={isHighlighted ? 'bg-[var(--accent-light)] animate-pulse' : ''}
                    >
                      <TableCell className="font-mono text-sm">
                        <Link href={`/products/${line.productId}`} className="text-[var(--accent-primary)] hover:underline">
                          {line.variant?.sku || line.product.sku}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{line.product.name}</p>
                          {variantName && (
                            <p className="text-sm text-[var(--text-muted)]">{variantName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] font-mono text-sm">{line.location.code}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.systemQty.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {stockTake.status === 'IN_PROGRESS' ? (
                          <Input
                            ref={(el) => { lineInputRefs.current[line.id] = el }}
                            type="number"
                            min="0"
                            value={edit.countedQty ?? ''}
                            onChange={(e) => updateLineEdit(
                              line.id,
                              'countedQty',
                              e.target.value ? Number(e.target.value) : null
                            )}
                            className={`w-24 text-right ${isHighlighted ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                          />
                        ) : (
                          <span className="font-mono font-medium">
                            {line.countedQty?.toLocaleString() ?? '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {variance !== null && (
                          <span className={`font-mono font-semibold flex items-center justify-end gap-1 ${
                            variance > 0 ? 'text-[var(--status-success)]' :
                            variance < 0 ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'
                          }`}>
                            {variance !== 0 && (
                              variance > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                            )}
                            {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
