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
  MapPin
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
      <PageHeader
        title="สแกน Barcode"
        description="สแกน Barcode/QR Code เพื่อค้นหาสินค้าและดำเนินการอย่างรวดเร็ว"
      />

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
