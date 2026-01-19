'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Upload, ArrowLeft, FileSpreadsheet, Loader2, Check, X, Download, Package, Warehouse, AlertTriangle, Palette } from 'lucide-react'
import { importProducts, importStock, validateProductImport, validateStockImport, importProductsWithVariants, type StockImportRow } from '@/actions/import'
import { parseCSV, parseCSVWithVariants, groupVariantRows, type ProductImportRow, type GroupedProductImport } from '@/lib/csv-parser'
import { toast } from 'sonner'

interface ValidationError {
  row: number
  field: string
  message: string
}

export default function ImportPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('products')
  
  // Product import state
  const [productCsvContent, setProductCsvContent] = useState('')
  const [productPreviewRows, setProductPreviewRows] = useState<ProductImportRow[]>([])
  const [productValidationErrors, setProductValidationErrors] = useState<ValidationError[]>([])
  const [isImportingProducts, setIsImportingProducts] = useState(false)
  const [productImportResult, setProductImportResult] = useState<{
    created: number
    updated: number
    errors: string[]
  } | null>(null)

  // Stock import state
  const [stockCsvContent, setStockCsvContent] = useState('')
  const [stockPreviewRows, setStockPreviewRows] = useState<StockImportRow[]>([])
  const [stockValidationErrors, setStockValidationErrors] = useState<ValidationError[]>([])
  const [isImportingStock, setIsImportingStock] = useState(false)
  const [stockImportResult, setStockImportResult] = useState<{
    total: number
    success: number
    errors: Array<{ row: number; message: string }>
  } | null>(null)

  // Variant import state
  const [variantCsvContent, setVariantCsvContent] = useState('')
  const [variantPreviewProducts, setVariantPreviewProducts] = useState<GroupedProductImport[]>([])
  const [isImportingVariants, setIsImportingVariants] = useState(false)
  const [variantImportResult, setVariantImportResult] = useState<{
    productsCreated: number
    productsUpdated: number
    variantsCreated: number
    variantsUpdated: number
    errors: string[]
  } | null>(null)

  // Product handlers
  function handleProductFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setProductCsvContent(content)
      handleProductPreview(content)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleProductPreview(content: string = productCsvContent) {
    const rows = parseCSV(content)
    const { valid, errors } = await validateProductImport(rows)
    setProductPreviewRows(rows.slice(0, 10))
    setProductValidationErrors(errors)
    setProductImportResult(null)
  }

  async function handleProductImport() {
    const rows = parseCSV(productCsvContent)
    if (rows.length === 0) {
      toast.error('ไม่พบข้อมูลที่จะนำเข้า')
      return
    }

    setIsImportingProducts(true)
    const result = await importProducts(rows)
    setIsImportingProducts(false)

    if (result.success) {
      setProductImportResult(result.data)
      toast.success(`นำเข้าสำเร็จ: สร้าง ${result.data.created}, อัปเดต ${result.data.updated}`)
      if (result.data.errors.length === 0) {
        setTimeout(() => router.push('/products'), 2000)
      }
    } else {
      toast.error(result.error)
    }
  }

  function downloadProductTemplate() {
    const template = `SKU,ชื่อสินค้า,รายละเอียด,Barcode,หมวดหมู่,หน่วย,Reorder Point,Min Qty,Max Qty,ต้นทุน
SHIRT-001,เสื้อยืดคอกลม ขาว S,,8851234567890,เสื้อ,PCS,50,10,200,120
SHIRT-002,เสื้อยืดคอกลม ขาว M,,8851234567891,เสื้อ,PCS,50,10,200,120
FABRIC-001,ผ้าฝ้าย 100% ขาว,ผ้าฝ้ายคุณภาพสูง,,วัตถุดิบ,M,100,50,500,85`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Stock handlers
  function handleStockFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setStockCsvContent(content)
      handleStockPreview(content)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleStockPreview(content: string = stockCsvContent) {
    const lines = content.trim().split('\n')
    if (lines.length < 2) return

    const rows: StockImportRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length >= 3) {
        rows.push({
          sku: cols[0],
          locationCode: cols[1],
          qty: parseFloat(cols[2]) || 0,
          unitCost: cols[3] ? parseFloat(cols[3]) : undefined,
        })
      }
    }

    const { valid, errors } = await validateStockImport(rows)
    setStockPreviewRows(rows.slice(0, 10))
    setStockValidationErrors(errors)
    setStockImportResult(null)
  }

  async function handleStockImport() {
    const lines = stockCsvContent.trim().split('\n')
    if (lines.length < 2) {
      toast.error('ไม่พบข้อมูลที่จะนำเข้า')
      return
    }

    const rows: StockImportRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length >= 3) {
        rows.push({
          sku: cols[0],
          locationCode: cols[1],
          qty: parseFloat(cols[2]) || 0,
          unitCost: cols[3] ? parseFloat(cols[3]) : undefined,
        })
      }
    }

    setIsImportingStock(true)
    const result = await importStock(rows)
    setIsImportingStock(false)

    if (result.success) {
      setStockImportResult(result.data)
      toast.success(`นำเข้าสำเร็จ: ${result.data.success} รายการ`)
      if (result.data.errors.length === 0) {
        setTimeout(() => router.push('/stock'), 2000)
      }
    } else {
      toast.error(result.error)
    }
  }

  function downloadStockTemplate() {
    const template = `SKU,ตำแหน่ง,จำนวน,ราคาทุน
SHIRT-001,WH01/A01,100,120
SHIRT-002,WH01/A01,80,120
FABRIC-001,WH01/B01,500,85`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'stock-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Variant handlers
  function handleVariantFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setVariantCsvContent(content)
      handleVariantPreview(content)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleVariantPreview(content: string = variantCsvContent) {
    const rows = parseCSVWithVariants(content)
    const grouped = groupVariantRows(rows)
    setVariantPreviewProducts(grouped.slice(0, 10))
    setVariantImportResult(null)
  }

  async function handleVariantImport() {
    const rows = parseCSVWithVariants(variantCsvContent)
    const grouped = groupVariantRows(rows)
    
    if (grouped.length === 0) {
      toast.error('ไม่พบข้อมูลที่จะนำเข้า')
      return
    }

    setIsImportingVariants(true)
    const result = await importProductsWithVariants(grouped)
    setIsImportingVariants(false)

    if (result.success) {
      setVariantImportResult(result.data)
      toast.success(`นำเข้าสำเร็จ: สินค้า ${result.data.productsCreated + result.data.productsUpdated}, ตัวเลือก ${result.data.variantsCreated + result.data.variantsUpdated}`)
      if (result.data.errors.length === 0) {
        setTimeout(() => router.push('/products'), 2000)
      }
    } else {
      toast.error(result.error)
    }
  }

  function downloadVariantTemplate() {
    const template = `รหัสสินค้า,ชื่อสินค้า,หมวดหมู่,หน่วย,ต้นทุน,Variant SKU,สี,ไซส์,Barcode
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-WH-S,ขาว,S,8851234567890
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-WH-M,ขาว,M,8851234567891
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-WH-L,ขาว,L,8851234567892
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-BK-S,ดำ,S,8851234567893
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-BK-M,ดำ,M,8851234567894
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-BK-L,ดำ,L,8851234567895
POLO-001,เสื้อโปโล Premium,เสื้อ,PCS,250,POLO-001-NV-S,กรม,S,8851234568001
POLO-001,เสื้อโปโล Premium,เสื้อ,PCS,250,POLO-001-NV-M,กรม,M,8851234568002
POLO-001,เสื้อโปโล Premium,เสื้อ,PCS,250,POLO-001-NV-L,กรม,L,8851234568003`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-variants-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Upload className="w-6 h-6 text-[var(--accent-primary)]" />
            นำเข้าข้อมูล
          </h1>
          <p className="text-[var(--text-muted)] mt-1">นำเข้าสินค้าหรือสต๊อคจากไฟล์ CSV</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-default)]">
          <TabsTrigger 
            value="products" 
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white"
          >
            <Package className="w-4 h-4" />
            สินค้าพื้นฐาน
          </TabsTrigger>
          <TabsTrigger 
            value="variants" 
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-[var(--status-info)] data-[state=active]:text-white"
          >
            <Palette className="w-4 h-4" />
            สินค้า+ตัวเลือก
          </TabsTrigger>
          <TabsTrigger 
            value="stock" 
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-[var(--status-success)] data-[state=active]:text-white"
          >
            <Warehouse className="w-4 h-4" />
            นำเข้าสต๊อค
          </TabsTrigger>
        </TabsList>

        {/* Product Import Tab */}
        <TabsContent value="products" className="space-y-6">
          {/* Instructions */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">คำแนะนำ - นำเข้าสินค้า</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                เตรียมไฟล์ CSV ที่มี header ตามรูปแบบที่กำหนด
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-primary)] font-medium mb-2">Columns ที่รองรับ:</p>
                  <ul className="text-[var(--text-muted)] space-y-1">
                    <li>• <code className="text-[var(--accent-primary)]">SKU</code> - รหัสสินค้า (จำเป็น)</li>
                    <li>• <code className="text-[var(--accent-primary)]">ชื่อสินค้า</code> - ชื่อ (จำเป็น)</li>
                    <li>• <code className="text-[var(--accent-primary)]">รายละเอียด</code></li>
                    <li>• <code className="text-[var(--accent-primary)]">Barcode</code></li>
                    <li>• <code className="text-[var(--accent-primary)]">หมวดหมู่</code></li>
                  </ul>
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-medium mb-2">&nbsp;</p>
                  <ul className="text-[var(--text-muted)] space-y-1">
                    <li>• <code className="text-[var(--accent-primary)]">หน่วย</code> - รหัสหน่วย (PCS, M, KG)</li>
                    <li>• <code className="text-[var(--accent-primary)]">Reorder Point</code></li>
                    <li>• <code className="text-[var(--accent-primary)]">Min Qty</code></li>
                    <li>• <code className="text-[var(--accent-primary)]">Max Qty</code></li>
                    <li>• <code className="text-[var(--accent-primary)]">ต้นทุน</code></li>
                  </ul>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={downloadProductTemplate}
                className="border-[var(--border-default)] text-[var(--text-secondary)]"
              >
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลด Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">อัปโหลดไฟล์</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center hover:border-[var(--accent-primary)]/50 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleProductFileUpload}
                  className="hidden"
                  id="product-csv-upload"
                />
                <label
                  htmlFor="product-csv-upload"
                  className="cursor-pointer text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium"
                >
                  เลือกไฟล์ CSV
                </label>
                <p className="text-[var(--text-muted)] text-sm mt-2">หรือวางเนื้อหา CSV ด้านล่าง</p>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={productCsvContent}
                  onChange={(e) => setProductCsvContent(e.target.value)}
                  placeholder="วางเนื้อหา CSV ที่นี่..."
                  rows={6}
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm"
                />
                <Button
                  onClick={() => handleProductPreview()}
                  disabled={!productCsvContent}
                  variant="outline"
                  className="border-[var(--border-default)] text-[var(--text-secondary)]"
                >
                  แสดงตัวอย่าง
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Validation Errors */}
          {productValidationErrors.length > 0 && (
            <Card className="bg-[var(--status-error)]/10 border-[var(--status-error)]/30">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--status-error)] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  พบข้อผิดพลาด {productValidationErrors.length} รายการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {productValidationErrors.map((err, idx) => (
                    <div key={idx} className="text-sm text-[var(--status-error)]/80">
                      Row {err.row}: <span className="text-[var(--status-error)]">{err.field}</span> - {err.message}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {productPreviewRows.length > 0 && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                  <span>ตัวอย่างข้อมูล (แสดง 10 รายการแรก จากทั้งหมด {parseCSV(productCsvContent).length})</span>
                  {productValidationErrors.length === 0 && (
                    <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">พร้อมนำเข้า</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-default)]">
                      <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                      <TableHead className="text-[var(--text-muted)]">ชื่อสินค้า</TableHead>
                      <TableHead className="text-[var(--text-muted)]">หมวดหมู่</TableHead>
                      <TableHead className="text-[var(--text-muted)]">หน่วย</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">ROP</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">ต้นทุน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productPreviewRows.map((row, idx) => (
                      <TableRow key={idx} className="border-[var(--border-default)]">
                        <TableCell className="font-mono text-[var(--accent-primary)] text-sm">
                          {row.sku}
                        </TableCell>
                        <TableCell className="text-[var(--text-primary)]">{row.name}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{row.categoryName || '-'}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{row.unitCode || '-'}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {row.reorderPoint ?? '-'}
                        </TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {row.standardCost ? `฿${row.standardCost}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Import Result */}
          {productImportResult && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  {productImportResult.errors.length === 0 ? (
                    <Check className="w-5 h-5 text-[var(--status-success)]" />
                  ) : (
                    <X className="w-5 h-5 text-[var(--status-warning)]" />
                  )}
                  ผลการนำเข้า
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-[var(--status-success-light)] rounded-lg border border-[var(--status-success)]/20">
                    <p className="text-2xl font-bold text-[var(--status-success)]">{productImportResult.created}</p>
                    <p className="text-sm text-[var(--text-muted)]">สร้างใหม่</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-info)]/10 rounded-lg border border-[var(--status-info)]/20">
                    <p className="text-2xl font-bold text-[var(--status-info)]">{productImportResult.updated}</p>
                    <p className="text-sm text-[var(--text-muted)]">อัปเดต</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-error)]/10 rounded-lg border border-[var(--status-error)]/20">
                    <p className="text-2xl font-bold text-[var(--status-error)]">{productImportResult.errors.length}</p>
                    <p className="text-sm text-[var(--text-muted)]">ข้อผิดพลาด</p>
                  </div>
                </div>

                {productImportResult.errors.length > 0 && (
                  <div className="bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg p-4">
                    <p className="text-[var(--status-error)] font-medium mb-2">ข้อผิดพลาด:</p>
                    <ul className="text-sm text-[var(--status-error)]/80 space-y-1 max-h-40 overflow-y-auto">
                      {productImportResult.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/products">
              <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
                ยกเลิก
              </Button>
            </Link>
            <Button
              onClick={handleProductImport}
              disabled={isImportingProducts || productPreviewRows.length === 0 || productValidationErrors.length > 0}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              {isImportingProducts ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  นำเข้าสินค้า ({parseCSV(productCsvContent).length} รายการ)
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Variant Import Tab */}
        <TabsContent value="variants" className="space-y-6">
          {/* Instructions */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">คำแนะนำ - นำเข้าสินค้าพร้อมตัวเลือก (สี/ไซส์)</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                นำเข้าสินค้าที่มีหลายสีหลายไซส์พร้อมกัน แต่ละแถวคือ 1 ตัวเลือก
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-primary)] font-medium mb-2">ข้อมูลสินค้า:</p>
                  <ul className="text-[var(--text-muted)] space-y-1">
                    <li>• <code className="text-[var(--status-info)]">รหัสสินค้า</code> - SKU หลัก (จำเป็น)</li>
                    <li>• <code className="text-[var(--status-info)]">ชื่อสินค้า</code> - ชื่อ (จำเป็น)</li>
                    <li>• <code className="text-[var(--status-info)]">หมวดหมู่</code></li>
                    <li>• <code className="text-[var(--status-info)]">หน่วย</code></li>
                    <li>• <code className="text-[var(--status-info)]">ต้นทุน</code></li>
                  </ul>
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-medium mb-2">ข้อมูลตัวเลือก:</p>
                  <ul className="text-[var(--text-muted)] space-y-1">
                    <li>• <code className="text-[var(--accent-primary)]">Variant SKU</code> - รหัส Variant</li>
                    <li>• <code className="text-[var(--accent-primary)]">สี</code> - สีของตัวเลือก</li>
                    <li>• <code className="text-[var(--accent-primary)]">ไซส์</code> - ไซส์ของตัวเลือก</li>
                    <li>• <code className="text-[var(--accent-primary)]">Barcode</code> - Barcode ของ Variant</li>
                  </ul>
                </div>
              </div>
              <div className="p-3 bg-[var(--status-info)]/10 border border-[var(--status-info)]/30 rounded-lg">
                <p className="text-[var(--status-info)] text-sm">
                  💡 สินค้าเดียวกัน (SKU เดียวกัน) สามารถมีหลายแถวได้ ระบบจะจัดกลุ่มให้อัตโนมัติ
                </p>
              </div>
              <Button
                variant="outline"
                onClick={downloadVariantTemplate}
                className="border-[var(--border-default)] text-[var(--text-secondary)]"
              >
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลด Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">อัปโหลดไฟล์</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center hover:border-[var(--status-info)]/50 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleVariantFileUpload}
                  className="hidden"
                  id="variant-csv-upload"
                />
                <label
                  htmlFor="variant-csv-upload"
                  className="cursor-pointer text-[var(--status-info)] hover:opacity-80 font-medium"
                >
                  เลือกไฟล์ CSV
                </label>
                <p className="text-[var(--text-muted)] text-sm mt-2">หรือวางเนื้อหา CSV ด้านล่าง</p>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={variantCsvContent}
                  onChange={(e) => setVariantCsvContent(e.target.value)}
                  placeholder="รหัสสินค้า,ชื่อสินค้า,หมวดหมู่,หน่วย,ต้นทุน,Variant SKU,สี,ไซส์,Barcode&#10;SHIRT-001,เสื้อยืดคอกลม,เสื้อ,PCS,120,SHIRT-001-WH-S,ขาว,S,8851234567890"
                  rows={6}
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm"
                />
                <Button
                  onClick={() => handleVariantPreview()}
                  disabled={!variantCsvContent}
                  variant="outline"
                  className="border-[var(--border-default)] text-[var(--text-secondary)]"
                >
                  แสดงตัวอย่าง
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {variantPreviewProducts.length > 0 && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                  <span>ตัวอย่างข้อมูล ({variantPreviewProducts.length} สินค้า, {variantPreviewProducts.reduce((sum, p) => sum + p.variants.length, 0)} ตัวเลือก)</span>
                  <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">พร้อมนำเข้า</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {variantPreviewProducts.map((product, idx) => (
                  <div key={idx} className="border border-[var(--border-default)] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{product.name}</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          SKU: <span className="font-mono text-[var(--status-info)]">{product.sku}</span>
                          {product.categoryName && <span className="ml-3">หมวด: {product.categoryName}</span>}
                        </p>
                      </div>
                      <Badge className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                        {product.variants.length} ตัวเลือก
                      </Badge>
                    </div>
                    {product.variants.length > 0 && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {product.variants.map((v, vIdx) => (
                            <div key={vIdx} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-3 py-1.5 text-sm">
                              <span className="font-mono text-[var(--accent-primary)]">{v.variantSku}</span>
                              <span className="text-[var(--text-muted)] ml-2">
                                {[v.color, v.size].filter(Boolean).join(' / ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Import Result */}
          {variantImportResult && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  {variantImportResult.errors.length === 0 ? (
                    <Check className="w-5 h-5 text-[var(--status-success)]" />
                  ) : (
                    <X className="w-5 h-5 text-[var(--status-warning)]" />
                  )}
                  ผลการนำเข้า
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-[var(--status-success-light)] rounded-lg border border-[var(--status-success)]/20">
                    <p className="text-2xl font-bold text-[var(--status-success)]">{variantImportResult.productsCreated}</p>
                    <p className="text-sm text-[var(--text-muted)]">สินค้าใหม่</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-info)]/10 rounded-lg border border-[var(--status-info)]/20">
                    <p className="text-2xl font-bold text-[var(--status-info)]">{variantImportResult.productsUpdated}</p>
                    <p className="text-sm text-[var(--text-muted)]">สินค้าอัปเดต</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/20">
                    <p className="text-2xl font-bold text-[var(--accent-primary)]">{variantImportResult.variantsCreated}</p>
                    <p className="text-sm text-[var(--text-muted)]">ตัวเลือกใหม่</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-error)]/10 rounded-lg border border-[var(--status-error)]/20">
                    <p className="text-2xl font-bold text-[var(--status-error)]">{variantImportResult.errors.length}</p>
                    <p className="text-sm text-[var(--text-muted)]">ข้อผิดพลาด</p>
                  </div>
                </div>

                {variantImportResult.errors.length > 0 && (
                  <div className="bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg p-4">
                    <p className="text-[var(--status-error)] font-medium mb-2">ข้อผิดพลาด:</p>
                    <ul className="text-sm text-[var(--status-error)]/80 space-y-1 max-h-40 overflow-y-auto">
                      {variantImportResult.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/products">
              <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
                ยกเลิก
              </Button>
            </Link>
            <Button
              onClick={handleVariantImport}
              disabled={isImportingVariants || variantPreviewProducts.length === 0}
              className="bg-[var(--status-info)] hover:opacity-90"
            >
              {isImportingVariants ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  นำเข้าสินค้า+ตัวเลือก
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Stock Import Tab */}
        <TabsContent value="stock" className="space-y-6">
          {/* Instructions */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">คำแนะนำ - นำเข้าสต๊อค</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                นำเข้าสต๊อคเริ่มต้นสำหรับสินค้าที่มีอยู่แล้ว
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <p className="text-[var(--text-primary)] font-medium mb-2">Columns ที่รองรับ:</p>
                <ul className="text-[var(--text-muted)] space-y-1">
                  <li>• <code className="text-[var(--status-success)]">SKU</code> - รหัสสินค้าหรือ Variant (จำเป็น)</li>
                  <li>• <code className="text-[var(--status-success)]">ตำแหน่ง</code> - รหัสตำแหน่ง เช่น WH01/A01 (จำเป็น)</li>
                  <li>• <code className="text-[var(--status-success)]">จำนวน</code> - จำนวนที่จะนำเข้า (จำเป็น)</li>
                  <li>• <code className="text-[var(--status-success)]">ราคาทุน</code> - ราคาต่อหน่วย (ถ้ามี)</li>
                </ul>
              </div>
              <div className="p-3 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded-lg">
                <p className="text-[var(--status-warning)] text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  ระบบจะสร้าง Adjust Movement อัตโนมัติเพื่อเพิ่มสต๊อคตามจำนวนที่ระบุ
                </p>
              </div>
              <Button
                variant="outline"
                onClick={downloadStockTemplate}
                className="border-[var(--border-default)] text-[var(--text-secondary)]"
              >
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลด Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">อัปโหลดไฟล์</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center hover:border-[var(--status-success)]/50 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleStockFileUpload}
                  className="hidden"
                  id="stock-csv-upload"
                />
                <label
                  htmlFor="stock-csv-upload"
                  className="cursor-pointer text-[var(--status-success)] hover:opacity-80 font-medium"
                >
                  เลือกไฟล์ CSV
                </label>
                <p className="text-[var(--text-muted)] text-sm mt-2">หรือวางเนื้อหา CSV ด้านล่าง</p>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={stockCsvContent}
                  onChange={(e) => setStockCsvContent(e.target.value)}
                  placeholder="SKU,ตำแหน่ง,จำนวน,ราคาทุน&#10;SHIRT-001,WH01/A01,100,120"
                  rows={6}
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm"
                />
                <Button
                  onClick={() => handleStockPreview()}
                  disabled={!stockCsvContent}
                  variant="outline"
                  className="border-[var(--border-default)] text-[var(--text-secondary)]"
                >
                  แสดงตัวอย่าง
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Validation Errors */}
          {stockValidationErrors.length > 0 && (
            <Card className="bg-[var(--status-error)]/10 border-[var(--status-error)]/30">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--status-error)] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  พบข้อผิดพลาด {stockValidationErrors.length} รายการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {stockValidationErrors.map((err, idx) => (
                    <div key={idx} className="text-sm text-[var(--status-error)]/80">
                      Row {err.row}: <span className="text-[var(--status-error)]">{err.field}</span> - {err.message}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {stockPreviewRows.length > 0 && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                  <span>ตัวอย่างข้อมูล (แสดง 10 รายการแรก)</span>
                  {stockValidationErrors.length === 0 && (
                    <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">พร้อมนำเข้า</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-default)]">
                      <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                      <TableHead className="text-[var(--text-muted)]">ตำแหน่ง</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">จำนวน</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">ราคาทุน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockPreviewRows.map((row, idx) => (
                      <TableRow key={idx} className="border-[var(--border-default)]">
                        <TableCell className="font-mono text-[var(--status-success)] text-sm">
                          {row.sku}
                        </TableCell>
                        <TableCell className="text-[var(--text-primary)]">{row.locationCode}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {row.qty.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">
                          {row.unitCost ? `฿${row.unitCost}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Import Result */}
          {stockImportResult && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  {stockImportResult.errors.length === 0 ? (
                    <Check className="w-5 h-5 text-[var(--status-success)]" />
                  ) : (
                    <X className="w-5 h-5 text-[var(--status-warning)]" />
                  )}
                  ผลการนำเข้า
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-[var(--status-success-light)] rounded-lg border border-[var(--status-success)]/20">
                    <p className="text-2xl font-bold text-[var(--status-success)]">{stockImportResult.success}</p>
                    <p className="text-sm text-[var(--text-muted)]">นำเข้าสำเร็จ</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-error)]/10 rounded-lg border border-[var(--status-error)]/20">
                    <p className="text-2xl font-bold text-[var(--status-error)]">{stockImportResult.errors.length}</p>
                    <p className="text-sm text-[var(--text-muted)]">ข้อผิดพลาด</p>
                  </div>
                </div>

                {stockImportResult.errors.length > 0 && (
                  <div className="bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg p-4">
                    <p className="text-[var(--status-error)] font-medium mb-2">ข้อผิดพลาด:</p>
                    <ul className="text-sm text-[var(--status-error)]/80 space-y-1 max-h-40 overflow-y-auto">
                      {stockImportResult.errors.map((err, idx) => (
                        <li key={idx}>• Row {err.row}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/stock">
              <Button variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
                ยกเลิก
              </Button>
            </Link>
            <Button
              onClick={handleStockImport}
              disabled={isImportingStock || stockPreviewRows.length === 0 || stockValidationErrors.length > 0}
              className="bg-[var(--status-success)] hover:opacity-90"
            >
              {isImportingStock ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  นำเข้าสต๊อค ({stockPreviewRows.length} รายการ)
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
