'use client'

import { useRef, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Printer, ClipboardList } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'

interface StockTakeLineData {
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
}

interface StockTakeForPrint {
  id: string
  code: string
  status: string
  note: string | null
  createdAt: Date
  warehouse: { id: string; name: string; code: string }
  countedBy: { id: string; name: string } | null
  lines: StockTakeLineData[]
}

interface PrintStockTakeSheetProps {
  stockTake: StockTakeForPrint
}

type SortBy = 'location' | 'sku' | 'name'

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVariantName(line: StockTakeLineData): string {
  return (
    line.variant?.optionValues
      ?.map((ov) => ov.optionValue.value)
      .join(', ') ||
    line.variant?.name ||
    ''
  )
}

function getSortedLines(lines: StockTakeLineData[], sortBy: SortBy): StockTakeLineData[] {
  return [...lines].sort((a, b) => {
    switch (sortBy) {
      case 'location':
        return a.location.code.localeCompare(b.location.code) ||
          a.product.sku.localeCompare(b.product.sku)
      case 'sku': {
        const skuA = a.variant?.sku || a.product.sku
        const skuB = b.variant?.sku || b.product.sku
        return skuA.localeCompare(skuB)
      }
      case 'name':
        return a.product.name.localeCompare(b.product.name)
      default:
        return 0
    }
  })
}

function groupByLocation(lines: StockTakeLineData[]): Map<string, StockTakeLineData[]> {
  const groups = new Map<string, StockTakeLineData[]>()
  for (const line of lines) {
    const key = line.location.code
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(line)
  }
  return groups
}

export function PrintStockTakeSheet({ stockTake }: PrintStockTakeSheetProps) {
  const [open, setOpen] = useState(false)
  const [showSystemQty, setShowSystemQty] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('location')

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `StockCount-${stockTake.code}`,
    onAfterPrint: () => {
      toast.success('พิมพ์ใบนับสต๊อคเรียบร้อย')
    },
  })

  const sortedLines = useMemo(
    () => getSortedLines(stockTake.lines, sortBy),
    [stockTake.lines, sortBy]
  )

  const locationGroups = useMemo(
    () => (sortBy === 'location' ? groupByLocation(sortedLines) : null),
    [sortedLines, sortBy]
  )

  const printDate = formatDateTime(new Date())

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          พิมพ์ใบนับ
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[var(--accent-primary)]" />
            พิมพ์ใบนับสต๊อค
          </DialogTitle>
          <DialogDescription>
            {stockTake.code} - {stockTake.warehouse.name} ({stockTake.lines.length} รายการ)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Blind Count Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-system-qty">แสดงยอดในระบบ</Label>
              <p className="text-xs text-[var(--text-muted)]">
                {showSystemQty
                  ? 'พนักงานจะเห็นยอดเดิมในระบบ'
                  : 'Blind Count - นับตามจริงโดยไม่เห็นยอดเดิม'}
              </p>
            </div>
            <Switch
              id="show-system-qty"
              checked={showSystemQty}
              onCheckedChange={setShowSystemQty}
            />
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <Label>เรียงตาม</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="location">ตำแหน่งจัดเก็บ</SelectItem>
                <SelectItem value="sku">รหัสสินค้า (SKU)</SelectItem>
                <SelectItem value="name">ชื่อสินค้า</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] space-y-1">
            <p className="text-sm">
              รวม: <span className="font-bold text-[var(--accent-primary)]">{stockTake.lines.length}</span> รายการ
            </p>
            {locationGroups && (
              <p className="text-sm text-[var(--text-muted)]">
                {locationGroups.size} ตำแหน่ง
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button onClick={() => handlePrint()}>
            <Printer className="w-4 h-4 mr-2" />
            พิมพ์ใบนับ
          </Button>
        </DialogFooter>

        {/* Hidden Print Area */}
        <div className="hidden">
          <div ref={printRef}>
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 12mm 10mm;
                }
                body {
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            `}</style>

            <div style={{
              fontFamily: '"Sarabun", "Noto Sans Thai", sans-serif',
              color: '#000',
              fontSize: '11px',
              lineHeight: '1.4',
            }}>
              {/* Document Header */}
              <div style={{
                borderBottom: '2px solid #000',
                paddingBottom: '8px',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                      ใบนับสต๊อค
                    </h1>
                    <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>Stock Count Sheet</p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px' }}>
                    <p style={{ margin: '0 0 2px 0' }}>
                      <strong>เลขที่:</strong> {stockTake.code}
                    </p>
                    <p style={{ margin: '0 0 2px 0' }}>
                      <strong>วันที่สร้าง:</strong> {formatDate(stockTake.createdAt)}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>วันที่พิมพ์:</strong> {printDate}
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '24px',
                  marginTop: '8px',
                  fontSize: '11px',
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>คลังสินค้า:</strong> {stockTake.warehouse.name} ({stockTake.warehouse.code})
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>จำนวนรายการ:</strong> {stockTake.lines.length} รายการ
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '24px',
                  marginTop: '6px',
                  fontSize: '11px',
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>ผู้นับ:</strong> ___________________________
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>วันที่นับ:</strong> _____/_____/_________
                  </p>
                </div>

                {stockTake.note && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: '#555' }}>
                    <strong>หมายเหตุ:</strong> {stockTake.note}
                  </p>
                )}

                {!showSystemQty && (
                  <p style={{
                    margin: '6px 0 0 0',
                    fontSize: '10px',
                    fontStyle: 'italic',
                    color: '#888',
                  }}>
                    * Blind Count - ไม่แสดงยอดในระบบ
                  </p>
                )}
              </div>

              {/* Table Content */}
              {sortBy === 'location' && locationGroups ? (
                // Grouped by location
                Array.from(locationGroups.entries()).map(([locationCode, lines], groupIdx) => {
                  const locationName = lines[0]?.location.name || locationCode
                  return (
                    <div key={locationCode} style={{
                      marginBottom: '16px',
                      pageBreakInside: 'avoid',
                    }}>
                      <div style={{
                        backgroundColor: '#f0f0f0',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        borderTop: '1px solid #000',
                        borderLeft: '1px solid #000',
                        borderRight: '1px solid #000',
                      }}>
                        {locationCode} - {locationName}
                        <span style={{ fontWeight: 'normal', color: '#555', marginLeft: '8px' }}>
                          ({lines.length} รายการ)
                        </span>
                      </div>
                      <CountTable
                        lines={lines}
                        showSystemQty={showSystemQty}
                        startIndex={
                          Array.from(locationGroups.values())
                            .slice(0, groupIdx)
                            .reduce((sum, g) => sum + g.length, 0)
                        }
                      />
                    </div>
                  )
                })
              ) : (
                // Flat list (sorted by SKU or name)
                <CountTable
                  lines={sortedLines}
                  showSystemQty={showSystemQty}
                  showLocation
                  startIndex={0}
                />
              )}

              {/* Footer - Signatures */}
              <div style={{
                marginTop: '32px',
                paddingTop: '16px',
                borderTop: '1px solid #ccc',
                display: 'flex',
                justifyContent: 'space-around',
                fontSize: '11px',
                pageBreakInside: 'avoid',
              }}>
                <div style={{ textAlign: 'center', width: '40%' }}>
                  <p style={{ margin: '0 0 40px 0' }}>ผู้นับ</p>
                  <div style={{ borderBottom: '1px solid #000', marginBottom: '4px' }} />
                  <p style={{ margin: '2px 0' }}>ลงชื่อ: ___________________________</p>
                  <p style={{ margin: '2px 0' }}>วันที่: _____/_____/_________</p>
                </div>
                <div style={{ textAlign: 'center', width: '40%' }}>
                  <p style={{ margin: '0 0 40px 0' }}>ผู้ตรวจสอบ</p>
                  <div style={{ borderBottom: '1px solid #000', marginBottom: '4px' }} />
                  <p style={{ margin: '2px 0' }}>ลงชื่อ: ___________________________</p>
                  <p style={{ margin: '2px 0' }}>วันที่: _____/_____/_________</p>
                </div>
              </div>

              {/* Page footer note */}
              <div style={{
                marginTop: '16px',
                fontSize: '9px',
                color: '#999',
                textAlign: 'center',
              }}>
                เอกสารนี้พิมพ์จากระบบจัดการสต๊อค | {stockTake.code} | พิมพ์เมื่อ {printDate}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sub-component: Count Table
function CountTable({
  lines,
  showSystemQty,
  showLocation = false,
  startIndex,
}: {
  lines: StockTakeLineData[]
  showSystemQty: boolean
  showLocation?: boolean
  startIndex: number
}) {
  const cellStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '3px 6px',
    verticalAlign: 'top',
    fontSize: '10px',
  }

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: '#e8e8e8',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: '10px',
    whiteSpace: 'nowrap',
  }

  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '10px',
    }}>
      <thead>
        <tr>
          <th style={{ ...headerCellStyle, width: '28px' }}>#</th>
          <th style={{ ...headerCellStyle, width: '80px' }}>SKU</th>
          <th style={headerCellStyle}>ชื่อสินค้า</th>
          {showLocation && (
            <th style={{ ...headerCellStyle, width: '60px' }}>ตำแหน่ง</th>
          )}
          {showSystemQty && (
            <th style={{ ...headerCellStyle, width: '55px', textAlign: 'right' }}>ยอดระบบ</th>
          )}
          <th style={{ ...headerCellStyle, width: '65px' }}>นับได้</th>
          <th style={{ ...headerCellStyle, width: '100px' }}>หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => {
          const variantName = getVariantName(line)
          const displaySku = line.variant?.sku || line.product.sku

          return (
            <tr key={line.id}>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                {startIndex + idx + 1}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '9px' }}>
                {displaySku}
              </td>
              <td style={cellStyle}>
                {line.product.name}
                {variantName && (
                  <span style={{ color: '#555', fontSize: '9px' }}>
                    {' '}({variantName})
                  </span>
                )}
              </td>
              {showLocation && (
                <td style={{ ...cellStyle, fontFamily: 'monospace', textAlign: 'center', fontSize: '9px' }}>
                  {line.location.code}
                </td>
              )}
              {showSystemQty && (
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  {line.systemQty.toLocaleString()}
                </td>
              )}
              <td style={{
                ...cellStyle,
                backgroundColor: '#fafafa',
                minHeight: '20px',
              }}>
                {/* Empty cell for handwriting */}
              </td>
              <td style={{
                ...cellStyle,
                backgroundColor: '#fafafa',
                minHeight: '20px',
              }}>
                {/* Empty cell for notes */}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
