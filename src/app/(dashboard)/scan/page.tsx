'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  CameraScanner, 
  BarcodeInput, 
  useBarcodeScanner 
} from '@/components/barcode-scanner'
import { PrintLabel } from '@/components/print-label'
import { getProductByBarcode } from '@/actions/products'
import { getLocations } from '@/actions/warehouses'
import { createMovement } from '@/actions/movements'
import { toast } from 'sonner'
import { 
  Scan, 
  Camera, 
  Keyboard, 
  Package, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Box,
  MapPin,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Usb,
  MousePointer,
  Smartphone,
  Monitor,
  CheckCheck,
  XCircle,
  Lightbulb,
  Printer,
} from 'lucide-react'

type ScanMode = 'idle' | 'keyboard' | 'camera'
type ActionMode = 'view' | 'issue' | 'receive'

interface ScannedProduct {
  id: string
  sku: string
  name: string
  barcode: string | null
  categoryName: string | null
  unitName: string | null
  stock: { locationId: string; locationName: string; warehouseName: string; qty: number }[]
}

interface LocationOption {
  id: string
  name: string
  warehouseName: string
}

export default function ScanPage() {
  const router = useRouter()
  const [scanMode, setScanMode] = useState<ScanMode>('idle')
  const [actionMode, setActionMode] = useState<ActionMode>('view')
  const [isLoading, setIsLoading] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  
  // Quick action state
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [qty, setQty] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)

  // Listen for USB barcode scanner
  useBarcodeScanner(
    useCallback((barcode: string) => {
      handleScan(barcode)
    }, []),
    scanMode === 'idle'
  )

  async function handleScan(barcode: string) {
    setIsLoading(true)
    setNotFound(null)
    setScannedProduct(null)

    try {
      const result = await getProductByBarcode(barcode)
      
      if (!result) {
        setNotFound(barcode)
        toast.error(`ไม่พบสินค้า: ${barcode}`)
      } else {
        setScannedProduct({
          id: result.product.id,
          sku: result.product.sku,
          name: result.product.name,
          barcode: result.product.barcode ?? null,
          categoryName: result.product.category?.name ?? null,
          unitName: result.product.unit?.name ?? null,
          stock: result.stock,
        })
        toast.success(`พบสินค้า: ${result.product.name}`)
      }
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('เกิดข้อผิดพลาดในการค้นหา')
    } finally {
      setIsLoading(false)
      setScanMode('idle')
    }
  }

  async function openActionDialog(mode: ActionMode) {
    if (!scannedProduct) return
    
    setActionMode(mode)
    setQty(1)
    setSelectedLocation('')
    
    // Load locations
    try {
      const locs = await getLocations()
      setLocations(locs.map(l => ({
        id: l.id,
        name: l.name,
        warehouseName: l.warehouse?.name ?? '',
      })))
    } catch (error) {
      console.error('Failed to load locations:', error)
    }
    
    setShowActionDialog(true)
  }

  async function handleQuickAction() {
    if (!scannedProduct || !selectedLocation || qty <= 0) return

    setIsProcessing(true)

    try {
      const movementType = actionMode === 'issue' ? 'ISSUE' : 'RECEIVE'
      
      const result = await createMovement({
        type: movementType,
        note: `Quick ${movementType.toLowerCase()} via barcode scan`,
        lines: [{
          productId: scannedProduct.id,
          fromLocationId: actionMode === 'issue' ? selectedLocation : undefined,
          toLocationId: actionMode === 'receive' ? selectedLocation : undefined,
          qty,
        }],
      })

      if (result.success) {
        toast.success(
          actionMode === 'issue' 
            ? `เบิกออก ${qty} ชิ้น สำเร็จ` 
            : `รับเข้า ${qty} ชิ้น สำเร็จ`
        )
        setShowActionDialog(false)
        // Refresh product data
        handleScan(scannedProduct.barcode || scannedProduct.sku)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Quick action error:', error)
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsProcessing(false)
    }
  }

  const totalStock = scannedProduct?.stock.reduce((sum, s) => sum + s.qty, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="สแกน Barcode"
          description="สแกน Barcode/QR Code เพื่อค้นหาสินค้าและดำเนินการอย่างรวดเร็ว"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-2 shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
          คู่มือการใช้งาน
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* User Guide */}
      {showGuide && (
        <Card className="bg-gradient-to-br from-[var(--accent-light)] to-[var(--bg-elevated)] border-[var(--accent-primary)]/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-[var(--accent-primary)]">
              <Lightbulb className="w-5 h-5" />
              คู่มือการใช้งานเครื่องสแกน Barcode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Method 1: USB Scanner */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-sm font-bold">1</div>
                <Usb className="w-5 h-5 text-[var(--accent-primary)]" />
                เครื่องสแกน USB (แนะนำ)
              </h3>
              <div className="ml-8 space-y-2 text-sm text-[var(--text-secondary)]">
                <div className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <Monitor className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">วิธีต่อเครื่องสแกน</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>เสียบสาย USB ของเครื่องสแกนเข้ากับคอมพิวเตอร์</li>
                      <li>รอให้ Windows/Mac ติดตั้ง Driver อัตโนมัติ (ประมาณ 5-10 วินาที)</li>
                      <li>เครื่องสแกนพร้อมใช้งาน!</li>
                    </ol>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <MousePointer className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">วิธีสแกน</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>เปิดหน้านี้ค้างไว้</li>
                      <li>หันเครื่องสแกนไปที่ Barcode บนสินค้า</li>
                      <li>กดปุ่มสแกนบนเครื่อง → ระบบจะค้นหาสินค้าอัตโนมัติ</li>
                    </ol>
                    <p className="mt-2 text-xs text-[var(--status-success)] flex items-center gap-1">
                      <CheckCheck className="w-4 h-4" />
                      ไม่ต้องคลิกที่ช่องใดๆ สแกนได้ทันที!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Method 2: Camera */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-sm font-bold">2</div>
                <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
                สแกนด้วยกล้อง (มือถือ/Webcam)
              </h3>
              <div className="ml-8 space-y-2 text-sm text-[var(--text-secondary)]">
                <div className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <Smartphone className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">วิธีสแกน</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>กดปุ่ม &quot;สแกนด้วยกล้อง&quot;</li>
                      <li>อนุญาตให้เว็บไซต์เข้าถึงกล้อง (ครั้งแรกเท่านั้น)</li>
                      <li>หันกล้องไปที่ Barcode ให้อยู่ในกรอบ</li>
                      <li>ระบบจะสแกนอัตโนมัติเมื่ออ่านได้</li>
                    </ol>
                  </div>
                </div>
                <div className="p-3 bg-[var(--status-warning-light)] rounded-lg border border-[var(--status-warning)]/30">
                  <p className="text-[var(--status-warning)] text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>ต้องใช้ HTTPS และอนุญาตการเข้าถึงกล้อง | ความสว่างมีผลต่อการสแกน</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Method 3: Manual */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-sm font-bold">3</div>
                <Keyboard className="w-5 h-5 text-[var(--accent-primary)]" />
                พิมพ์เอง
              </h3>
              <div className="ml-8 space-y-2 text-sm text-[var(--text-secondary)]">
                <div className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <Keyboard className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">วิธีใช้</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>กดปุ่ม &quot;พิมพ์ Barcode / USB Scanner&quot;</li>
                      <li>พิมพ์หมายเลข Barcode หรือ SKU</li>
                      <li>กด Enter หรือกดปุ่มค้นหา</li>
                    </ol>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      สามารถพิมพ์ได้ทั้ง: รหัส Barcode, SKU, หรือรหัสสินค้า
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Real World Workflow */}
            <div className="space-y-3 pt-4 border-t border-[var(--border-default)]">
              <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <CheckCheck className="w-5 h-5 text-[var(--status-success)]" />
                ขั้นตอนการใช้งานจริง
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Workflow 1: Product with existing barcode */}
                <div className="p-4 bg-[var(--bg-secondary)] rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--status-success)] text-white flex items-center justify-center text-xs font-bold">A</div>
                    <p className="font-medium text-[var(--text-primary)]">สินค้ามี Barcode อยู่แล้ว</p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">(สินค้าสำเร็จรูป เช่น ขนม เครื่องดื่ม เครื่องสำอาง)</p>
                  <ol className="list-decimal list-inside text-sm text-[var(--text-secondary)] space-y-1">
                    <li>ไปที่ <strong>สินค้า → เพิ่มสินค้า</strong></li>
                    <li>กรอก SKU, ชื่อสินค้า</li>
                    <li>กรอก <strong>Barcode</strong> (ดูจากซองสินค้า เช่น 8851234567890)</li>
                    <li>บันทึก → พร้อมสแกนใช้งานได้เลย!</li>
                  </ol>
                </div>

                {/* Workflow 2: Product without barcode */}
                <div className="p-4 bg-[var(--bg-secondary)] rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-xs font-bold">B</div>
                    <p className="font-medium text-[var(--text-primary)]">สินค้าไม่มี Barcode</p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">(สินค้าทำเอง เช่น เสื้อ กระเป๋า หรือวัตถุดิบ)</p>
                  <ol className="list-decimal list-inside text-sm text-[var(--text-secondary)] space-y-1">
                    <li>ไปที่ <strong>สินค้า → เพิ่มสินค้า</strong></li>
                    <li>กรอก SKU, ชื่อสินค้า (ไม่ต้องกรอก Barcode)</li>
                    <li>บันทึก → ไปที่หน้าสินค้านั้น</li>
                    <li>กด <strong>&quot;พิมพ์ฉลาก&quot;</strong> → พิมพ์สติกเกอร์</li>
                    <li>แปะสติกเกอร์ที่สินค้า → สแกนได้!</li>
                  </ol>
                </div>
              </div>

              <div className="p-3 bg-[var(--status-info-light)] rounded-lg border border-[var(--status-info)]/30">
                <p className="text-sm text-[var(--status-info)]">
                  <strong>💡 สรุป:</strong> ถ้าสินค้าไม่มี Barcode ระบบจะใช้ <strong>SKU</strong> แทน Barcode อัตโนมัติ!
                </p>
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-3 pt-4 border-t border-[var(--border-default)]">
              <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <XCircle className="w-5 h-5 text-[var(--status-error)]" />
                แก้ไขปัญหา
              </h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <p className="font-medium text-[var(--text-primary)] mb-1">สแกนแล้วไม่เกิดอะไร?</p>
                  <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                    <li>ตรวจสอบว่าหน้านี้ถูกโฟกัส (คลิกที่หน้านี้)</li>
                    <li>ลองถอดแล้วเสียบสาย USB ใหม่</li>
                    <li>ตรวจสอบว่าเครื่องสแกนมีไฟเปิด</li>
                  </ul>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <p className="font-medium text-[var(--text-primary)] mb-1">กล้องไม่ทำงาน?</p>
                  <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                    <li>ตรวจสอบว่าอนุญาตการเข้าถึงกล้องแล้ว</li>
                    <li>ลองใช้ Browser อื่น (Chrome/Edge)</li>
                    <li>ตรวจสอบว่าไม่มีแอปอื่นใช้กล้องอยู่</li>
                  </ul>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <p className="font-medium text-[var(--text-primary)] mb-1">ไม่พบสินค้า?</p>
                  <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                    <li>ตรวจสอบว่าสินค้าถูกสร้างในระบบแล้ว</li>
                    <li>ตรวจสอบว่า Barcode ตรงกับที่บันทึกไว้</li>
                    <li>ลองค้นหาด้วย SKU แทน</li>
                  </ul>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <p className="font-medium text-[var(--text-primary)] mb-1">เครื่องสแกนยี่ห้อแนะนำ</p>
                  <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                    <li>Honeywell, Zebra, Datalogic</li>
                    <li>เลือกรุ่นที่รองรับ USB HID</li>
                    <li>ราคาประมาณ 500-2,000 บาท</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowGuide(false)}>
                ปิดคู่มือ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Controls */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scan className="w-5 h-5 text-[var(--accent-primary)]" />
            เลือกวิธีสแกน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scanMode === 'idle' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                size="lg"
                variant="outline"
                onClick={() => setScanMode('camera')}
                className="h-24 flex flex-col gap-2"
              >
                <Camera className="w-8 h-8 text-[var(--accent-primary)]" />
                <span>สแกนด้วยกล้อง</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setScanMode('keyboard')}
                className="h-24 flex flex-col gap-2"
              >
                <Keyboard className="w-8 h-8 text-[var(--accent-primary)]" />
                <span>พิมพ์ Barcode / USB Scanner</span>
              </Button>
            </div>
          )}

          {scanMode === 'keyboard' && (
            <div className="space-y-4">
              <BarcodeInput 
                onScan={handleScan} 
                placeholder="สแกนหรือพิมพ์ Barcode/SKU แล้วกด Enter..."
              />
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setScanMode('idle')}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}

          {scanMode === 'camera' && (
            <CameraScanner 
              onScan={handleScan} 
              onClose={() => setScanMode('idle')} 
            />
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
              <span className="text-[var(--text-muted)]">กำลังค้นหา...</span>
            </div>
          )}

          <p className="text-sm text-[var(--text-muted)] text-center">
            💡 เครื่องสแกน USB จะทำงานอัตโนมัติเมื่อสแกนทุกที่ในหน้านี้
          </p>
        </CardContent>
      </Card>

      {/* Not Found */}
      {notFound && (
        <Card className="bg-[var(--status-error-light)] border-[var(--status-error)]">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-[var(--status-error)]" />
              <div>
                <h3 className="font-semibold text-[var(--status-error)]">ไม่พบสินค้า</h3>
                <p className="text-[var(--text-secondary)]">
                  ไม่พบสินค้าที่มี Barcode หรือ SKU: <code className="bg-[var(--bg-secondary)] px-2 py-0.5 rounded">{notFound}</code>
                </p>
              </div>
              <Button 
                variant="outline" 
                className="ml-auto"
                onClick={() => router.push(`/products/new?barcode=${encodeURIComponent(notFound)}`)}
              >
                สร้างสินค้าใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanned Product */}
      {scannedProduct && (
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[var(--status-success-light)]">
                  <CheckCircle2 className="w-6 h-6 text-[var(--status-success)]" />
                </div>
                <div>
                  <CardTitle className="text-lg">{scannedProduct.name}</CardTitle>
                  <p className="text-sm text-[var(--text-muted)]">
                    SKU: {scannedProduct.sku}
                    {scannedProduct.barcode && ` | Barcode: ${scannedProduct.barcode}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/products/${scannedProduct.id}`)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                ดูรายละเอียด
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-muted)]">หมวดหมู่</p>
                <p className="font-medium">{scannedProduct.categoryName || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-muted)]">หน่วย</p>
                <p className="font-medium">{scannedProduct.unitName || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-muted)]">สต๊อคทั้งหมด</p>
                <p className="font-medium text-lg">{totalStock.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-muted)]">จำนวนโลเคชัน</p>
                <p className="font-medium text-lg">{scannedProduct.stock.length}</p>
              </div>
            </div>

            {/* Stock by Location */}
            {scannedProduct.stock.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  สต๊อคตามโลเคชัน
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {scannedProduct.stock.map((s) => (
                    <div
                      key={s.locationId}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                    >
                      <div>
                        <p className="font-medium">{s.locationName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{s.warehouseName}</p>
                      </div>
                      <p className="text-lg font-semibold text-[var(--accent-primary)]">
                        {s.qty.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--border-default)]">
              <Button 
                onClick={() => openActionDialog('issue')}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                เบิกออก
              </Button>
              <Button 
                onClick={() => openActionDialog('receive')}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                รับเข้า
              </Button>
              <PrintLabel
                product={{
                  sku: scannedProduct.sku,
                  name: scannedProduct.name,
                  barcode: scannedProduct.barcode,
                }}
              />
              <Button 
                onClick={() => {
                  setScannedProduct(null)
                  setScanMode('keyboard')
                }}
                className="flex-1 sm:flex-none"
              >
                <Scan className="w-4 h-4 mr-2" />
                สแกนต่อ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionMode === 'issue' ? (
                <ArrowUpFromLine className="w-5 h-5 text-[var(--status-warning)]" />
              ) : (
                <ArrowDownToLine className="w-5 h-5 text-[var(--status-success)]" />
              )}
              {actionMode === 'issue' ? 'เบิกออก' : 'รับเข้า'}
            </DialogTitle>
            <DialogDescription>
              {scannedProduct?.name} ({scannedProduct?.sku})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                {actionMode === 'issue' ? 'เบิกจากโลเคชัน' : 'รับเข้าโลเคชัน'}
              </Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกโลเคชัน" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.warehouseName} - {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>จำนวน</Label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              />
            </div>

            {actionMode === 'issue' && selectedLocation && (
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-sm text-[var(--text-muted)]">
                  สต๊อคในโลเคชันที่เลือก:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {scannedProduct?.stock.find(s => s.locationId === selectedLocation)?.qty ?? 0}
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleQuickAction} 
              disabled={!selectedLocation || qty <= 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : actionMode === 'issue' ? (
                <>
                  <ArrowUpFromLine className="w-4 h-4 mr-2" />
                  เบิกออก
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                  รับเข้า
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
