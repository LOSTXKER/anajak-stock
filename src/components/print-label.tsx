'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Printer, QrCode, Barcode, Loader2 } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'

interface LabelData {
  sku: string
  name: string
  barcode?: string | null
  price?: number | null
  unit?: string | null
}

interface PrintLabelProps {
  product: LabelData
  variant?: 'button' | 'icon'
}

type LabelSize = 'small' | 'medium' | 'large'
type CodeType = 'barcode' | 'qrcode'

const LABEL_SIZES = {
  small: { width: 50, height: 25, name: 'เล็ก (50x25mm)' },
  medium: { width: 70, height: 40, name: 'กลาง (70x40mm)' },
  large: { width: 100, height: 60, name: 'ใหญ่ (100x60mm)' },
}

export function PrintLabel({ product, variant = 'button' }: PrintLabelProps) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [labelSize, setLabelSize] = useState<LabelSize>('medium')
  const [codeType, setCodeType] = useState<CodeType>('barcode')
  const [showPrice, setShowPrice] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [barcodeImages, setBarcodeImages] = useState<string[]>([])

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Label-${product.sku}`,
    onAfterPrint: () => {
      toast.success('พิมพ์ฉลากเรียบร้อย')
      setOpen(false)
    },
  })

  async function generateLabels() {
    setIsGenerating(true)
    try {
      const code = product.barcode || product.sku
      const images: string[] = []

      // Dynamically import bwip-js
      const bwipjs = await import('bwip-js')

      for (let i = 0; i < quantity; i++) {
        const canvas = document.createElement('canvas')
        
        if (codeType === 'barcode') {
          await bwipjs.toCanvas(canvas, {
            bcid: 'code128',
            text: code,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
          })
        } else {
          await bwipjs.toCanvas(canvas, {
            bcid: 'qrcode',
            text: code,
            scale: 3,
            width: 25,
            height: 25,
          })
        }

        images.push(canvas.toDataURL('image/png'))
      }

      setBarcodeImages(images)
    } catch (error) {
      console.error('Error generating barcodes:', error)
      toast.error('ไม่สามารถสร้าง Barcode ได้')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handlePreviewAndPrint() {
    await generateLabels()
    setTimeout(() => {
      handlePrint()
    }, 100)
  }

  const size = LABEL_SIZES[labelSize]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'button' ? (
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            พิมพ์ฉลาก
          </Button>
        ) : (
          <Button variant="ghost" size="icon">
            <Printer className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[var(--accent-primary)]" />
            พิมพ์ฉลากสินค้า
          </DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label Size */}
          <div className="space-y-2">
            <Label>ขนาดฉลาก</Label>
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABEL_SIZES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Code Type */}
          <div className="space-y-2">
            <Label>ประเภทรหัส</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={codeType === 'barcode' ? 'default' : 'outline'}
                onClick={() => setCodeType('barcode')}
                className="flex-1"
              >
                <Barcode className="w-4 h-4 mr-2" />
                Barcode
              </Button>
              <Button
                type="button"
                variant={codeType === 'qrcode' ? 'default' : 'outline'}
                onClick={() => setCodeType('qrcode')}
                className="flex-1"
              >
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </Button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>จำนวนฉลาก</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Show Price Toggle */}
          {product.price && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPrice"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="showPrice">แสดงราคา</Label>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 border border-[var(--border-default)] rounded-lg bg-white">
            <p className="text-xs text-[var(--text-muted)] mb-2">ตัวอย่าง:</p>
            <div
              className="mx-auto bg-white text-black p-2 border border-gray-300"
              style={{ width: `${size.width}mm`, minHeight: `${size.height}mm` }}
            >
              <p className="text-xs font-bold truncate">{product.name}</p>
              <p className="text-xs text-gray-600">{product.sku}</p>
              <div className="flex justify-center my-1">
                {codeType === 'barcode' ? (
                  <Barcode className="w-full h-6 text-black" />
                ) : (
                  <QrCode className="w-8 h-8 text-black" />
                )}
              </div>
              {showPrice && product.price && (
                <p className="text-sm font-bold text-center">
                  ฿{product.price.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handlePreviewAndPrint} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                พิมพ์ {quantity} ฉลาก
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Hidden Print Area */}
        <div className="hidden">
          <div ref={printRef} className="p-4">
            <style>{`
              @media print {
                @page {
                  size: ${size.width}mm ${size.height}mm;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
              }
            `}</style>
            <div className="flex flex-wrap gap-1">
              {barcodeImages.map((img, index) => (
                <div
                  key={index}
                  className="bg-white text-black p-2 border border-gray-300 page-break-inside-avoid"
                  style={{ width: `${size.width}mm`, minHeight: `${size.height}mm` }}
                >
                  <p className="text-xs font-bold truncate">{product.name}</p>
                  <p className="text-xs text-gray-600">{product.sku}</p>
                  <div className="flex justify-center my-1">
                    <img src={img} alt={`Label ${index + 1}`} className="max-w-full" />
                  </div>
                  {showPrice && product.price && (
                    <p className="text-sm font-bold text-center">
                      ฿{product.price.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Bulk print for multiple products
interface BulkPrintLabelProps {
  products: LabelData[]
}

export function BulkPrintLabel({ products }: BulkPrintLabelProps) {
  const [open, setOpen] = useState(false)
  const [labelSize, setLabelSize] = useState<LabelSize>('medium')
  const [codeType, setCodeType] = useState<CodeType>('barcode')
  const [quantityPerProduct, setQuantityPerProduct] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [allBarcodeImages, setAllBarcodeImages] = useState<{ product: LabelData; images: string[] }[]>([])

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Labels-Batch`,
    onAfterPrint: () => {
      toast.success(`พิมพ์ฉลาก ${products.length} รายการเรียบร้อย`)
      setOpen(false)
    },
  })

  async function generateAllLabels() {
    setIsGenerating(true)
    try {
      const bwipjs = await import('bwip-js')
      const results: { product: LabelData; images: string[] }[] = []

      for (const product of products) {
        const code = product.barcode || product.sku
        const images: string[] = []

        for (let i = 0; i < quantityPerProduct; i++) {
          const canvas = document.createElement('canvas')

          if (codeType === 'barcode') {
            await bwipjs.toCanvas(canvas, {
              bcid: 'code128',
              text: code,
              scale: 3,
              height: 10,
              includetext: true,
              textxalign: 'center',
            })
          } else {
            await bwipjs.toCanvas(canvas, {
              bcid: 'qrcode',
              text: code,
              scale: 3,
              width: 25,
              height: 25,
            })
          }

          images.push(canvas.toDataURL('image/png'))
        }

        results.push({ product, images })
      }

      setAllBarcodeImages(results)
    } catch (error) {
      console.error('Error generating barcodes:', error)
      toast.error('ไม่สามารถสร้าง Barcode ได้')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handlePreviewAndPrint() {
    await generateAllLabels()
    setTimeout(() => {
      handlePrint()
    }, 100)
  }

  const size = LABEL_SIZES[labelSize]
  const totalLabels = products.length * quantityPerProduct

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          พิมพ์ฉลากทั้งหมด ({products.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[var(--accent-primary)]" />
            พิมพ์ฉลากหลายรายการ
          </DialogTitle>
          <DialogDescription>
            เลือก {products.length} สินค้า
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>ขนาดฉลาก</Label>
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABEL_SIZES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ประเภทรหัส</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={codeType === 'barcode' ? 'default' : 'outline'}
                onClick={() => setCodeType('barcode')}
                className="flex-1"
              >
                <Barcode className="w-4 h-4 mr-2" />
                Barcode
              </Button>
              <Button
                type="button"
                variant={codeType === 'qrcode' ? 'default' : 'outline'}
                onClick={() => setCodeType('qrcode')}
                className="flex-1"
              >
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>จำนวนฉลากต่อสินค้า</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={quantityPerProduct}
              onChange={(e) => setQuantityPerProduct(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
            <p className="text-sm">
              รวมทั้งหมด: <span className="font-bold text-[var(--accent-primary)]">{totalLabels}</span> ฉลาก
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handlePreviewAndPrint} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                พิมพ์ {totalLabels} ฉลาก
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Hidden Print Area */}
        <div className="hidden">
          <div ref={printRef} className="p-4">
            <div className="flex flex-wrap gap-1">
              {allBarcodeImages.flatMap(({ product, images }) =>
                images.map((img, index) => (
                  <div
                    key={`${product.sku}-${index}`}
                    className="bg-white text-black p-2 border border-gray-300"
                    style={{ width: `${size.width}mm`, minHeight: `${size.height}mm` }}
                  >
                    <p className="text-xs font-bold truncate">{product.name}</p>
                    <p className="text-xs text-gray-600">{product.sku}</p>
                    <div className="flex justify-center my-1">
                      <img src={img} alt={`Label ${index + 1}`} className="max-w-full" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
