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
import { Truck, ArrowLeft, Loader2, Package, CheckCircle2, AlertCircle } from 'lucide-react'
import { createGRN, getPO } from '@/actions/po'
import { getLocations } from '@/actions/stock'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'

interface POLine {
  id: string
  productId: string
  variantId?: string | null
  qty: number
  qtyReceived: number
  unitPrice: number
  product: {
    id: string
    name: string
    sku: string
  }
  variant?: {
    id: string
    name: string | null
    sku: string
    optionValues?: Array<{
      optionValue: {
        value: string
        optionType: { name: string }
      }
    }>
  } | null
}

interface PO {
  id: string
  poNumber: string
  status: string
  supplier: {
    name: string
  }
  lines: POLine[]
}

interface Location {
  id: string
  code: string
  name: string
  warehouse: {
    id: string
    name: string
  }
}

interface GRNLine {
  poLineId: string
  productId: string
  variantId?: string
  productName: string
  variantName?: string
  sku: string
  ordered: number
  received: number
  remaining: number
  qtyToReceive: number
  unitCost: number
  locationId: string
  note?: string
}

export default function NewGRNPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const poId = searchParams.get('poId')

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [po, setPO] = useState<PO | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<GRNLine[]>([])
  const [defaultLocationId, setDefaultLocationId] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!poId) {
        toast.error('ไม่พบ PO')
        router.push('/po')
        return
      }

      setIsLoadingData(true)
      try {
        const [poData, locationsData] = await Promise.all([
          getPO(poId),
          getLocations(),
        ])

        if (!poData) {
          toast.error('ไม่พบ PO')
          router.push('/po')
          return
        }

        if (!['SENT', 'IN_PROGRESS', 'PARTIALLY_RECEIVED'].includes(poData.status)) {
          toast.error('ไม่สามารถรับสินค้าจาก PO นี้ได้')
          router.push(`/po/${poId}`)
          return
        }

        setPO(poData as unknown as PO)
        setLocations(locationsData as Location[])

        // Set default location if only one exists
        if (locationsData.length === 1) {
          setDefaultLocationId(locationsData[0].id)
        }

        // Initialize lines from PO
        const grnLines: GRNLine[] = poData.lines
          .filter((line) => Number(line.qty) > Number(line.qtyReceived))
          .map((line) => {
            const remaining = Number(line.qty) - Number(line.qtyReceived)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lineWithVariant = line as any
            // สร้างชื่อ variant จาก optionValues
            const variantName = lineWithVariant.variant?.optionValues
              ?.map((ov: { optionValue: { value: string } }) => ov.optionValue.value)
              .join(', ') || lineWithVariant.variant?.name
            return {
              poLineId: line.id,
              productId: line.productId,
              variantId: lineWithVariant.variantId || undefined,
              productName: line.product.name,
              variantName,
              sku: lineWithVariant.variant?.sku || line.product.sku,
              ordered: Number(line.qty),
              received: Number(line.qtyReceived),
              remaining,
              qtyToReceive: remaining, // Default to receive all remaining
              unitCost: Number(line.unitPrice),
              locationId: locationsData.length === 1 ? locationsData[0].id : '',
            }
          })

        setLines(grnLines)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [poId, router])

  function updateLine(poLineId: string, updates: Partial<GRNLine>) {
    setLines(
      lines.map((line) =>
        line.poLineId === poLineId ? { ...line, ...updates } : line
      )
    )
  }

  function applyDefaultLocation() {
    if (!defaultLocationId) return
    setLines(
      lines.map((line) => ({
        ...line,
        locationId: defaultLocationId,
      }))
    )
    toast.success('ตั้งค่าโลเคชันทั้งหมดแล้ว')
  }

  function receiveAll() {
    setLines(
      lines.map((line) => ({
        ...line,
        qtyToReceive: line.remaining,
      }))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const linesToReceive = lines.filter((line) => line.qtyToReceive > 0)

    if (linesToReceive.length === 0) {
      toast.error('กรุณาระบุจำนวนที่ต้องการรับอย่างน้อย 1 รายการ')
      return
    }

    // Validate all lines have location
    const missingLocation = linesToReceive.find((line) => !line.locationId)
    if (missingLocation) {
      toast.error(`กรุณาเลือกโลเคชันสำหรับ "${missingLocation.productName}"`)
      return
    }

    // Validate quantities
    const overReceive = linesToReceive.find((line) => line.qtyToReceive > line.remaining)
    if (overReceive) {
      toast.error(`จำนวนรับของ "${overReceive.productName}" เกินจำนวนที่เหลือ`)
      return
    }

    setIsLoading(true)

    const result = await createGRN({
      poId: poId!,
      note,
      lines: linesToReceive.map((line) => ({
        poLineId: line.poLineId,
        productId: line.productId,
        variantId: line.variantId,
        locationId: line.locationId,
        qtyReceived: line.qtyToReceive,
        unitCost: line.unitCost,
        note: line.note,
      })),
    })

    setIsLoading(false)

    if (result.success) {
      toast.success('บันทึกการรับสินค้าเรียบร้อยแล้ว')
      router.push(`/po/${poId}`)
    } else {
      toast.error(result.error)
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--text-muted)]">กำลังโหลดข้อมูล PO...</p>
        </div>
      </div>
    )
  }

  if (!po) {
    return null
  }

  const totalToReceive = lines.reduce((sum, line) => sum + line.qtyToReceive, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/po/${poId}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="รับสินค้า (GRN)"
          description={`บันทึกการรับสินค้าจาก ${po.poNumber}`}
          icon={<Truck className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* PO Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลใบสั่งซื้อ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-[var(--text-muted)]">เลข PO</Label>
                <p className="font-medium">{po.poNumber}</p>
              </div>
              <div>
                <Label className="text-[var(--text-muted)]">Supplier</Label>
                <p className="font-medium">{po.supplier.name}</p>
              </div>
              <div>
                <Label className="text-[var(--text-muted)]">สถานะ</Label>
                <Badge variant="secondary">{po.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Location & Note */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ตั้งค่าการรับสินค้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>โลเคชันเริ่มต้น (ใช้กับทุกรายการ)</Label>
                <div className="flex gap-2">
                  <Select value={defaultLocationId} onValueChange={setDefaultLocationId}>
                    <SelectTrigger className="flex-1">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyDefaultLocation}
                    disabled={!defaultLocationId}
                  >
                    ใช้กับทั้งหมด
                  </Button>
                </div>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={receiveAll}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  รับครบทุกรายการ
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุการรับสินค้า..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-[var(--accent-primary)] rounded-full" />
                <CardTitle className="text-base">รายการสินค้าที่รับ</CardTitle>
                {totalToReceive > 0 && (
                  <Badge variant="secondary" className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                    รับ {totalToReceive.toLocaleString()} ชิ้น
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">สินค้า</TableHead>
                    <TableHead className="w-20 text-right">สั่ง</TableHead>
                    <TableHead className="w-20 text-right">รับแล้ว</TableHead>
                    <TableHead className="w-20 text-right">เหลือ</TableHead>
                    <TableHead className="w-28">รับครั้งนี้</TableHead>
                    <TableHead className="min-w-[180px]">โลเคชัน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                          <Package className="w-10 h-10 opacity-50" />
                          <p>ไม่มีรายการที่ต้องรับ</p>
                          <p className="text-sm">PO นี้รับสินค้าครบแล้ว</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => (
                      <TableRow key={line.poLineId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{line.productName}</p>
                            {line.variantName && (
                              <p className="text-sm text-[var(--text-muted)]">{line.variantName}</p>
                            )}
                            <p className="text-xs text-[var(--text-muted)] font-mono">{line.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {line.ordered.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[var(--status-success)]">
                          {line.received.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <Badge
                            variant="outline"
                            className={
                              line.remaining > 0
                                ? 'border-[var(--status-warning)] text-[var(--status-warning)]'
                                : 'border-[var(--status-success)] text-[var(--status-success)]'
                            }
                          >
                            {line.remaining.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={line.remaining}
                            value={line.qtyToReceive}
                            onChange={(e) =>
                              updateLine(line.poLineId, {
                                qtyToReceive: Math.min(Number(e.target.value), line.remaining),
                              })
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={line.locationId}
                            onValueChange={(v) => updateLine(line.poLineId, { locationId: v })}
                          >
                            <SelectTrigger className={!line.locationId && line.qtyToReceive > 0 ? 'border-[var(--status-error)]' : ''}>
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Summary & Actions */}
        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Package className="w-4 h-4" />
                  <span>รวมรับครั้งนี้:</span>
                </div>
                <span className="text-xl font-bold text-[var(--accent-primary)]">
                  {totalToReceive.toLocaleString()} ชิ้น
                </span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" asChild>
                  <Link href={`/po/${poId}`}>ยกเลิก</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || totalToReceive === 0}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Truck className="w-4 h-4 mr-2" />
                  )}
                  บันทึกการรับสินค้า
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
