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
import { Upload, ArrowLeft, FileSpreadsheet, Loader2, Check, X, Download, Package, Warehouse, AlertTriangle, RefreshCw } from 'lucide-react'
import { importProducts, importStock, validateProductImport, validateStockImport, importProductsWithVariants, type StockImportRow } from '@/actions/import'
import { updateVariantsFromCSV } from '@/actions/variants/import'
import { parseCSV, parseCSVWithVariants, groupVariantRows, detectHasVariantColumns, parseVariantUpdateCSV, type ProductImportRow, type GroupedProductImport, type VariantUpdateRow } from '@/lib/csv-parser'
import { 
  readXLSXFile, 
  parseXLSXProducts, 
  parseXLSXWithVariants, 
  detectXLSXHasVariantColumns, 
  parseXLSXVariantUpdate, 
  parseXLSXStock,
  isXLSXFile,
  isCSVFile,
} from '@/lib/xlsx-parser'
import { toast } from 'sonner'

interface ValidationError {
  row: number
  field: string
  message: string
}

export default function ImportPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('products')
  
  // Product import state (unified - supports both basic and variants)
  const [productCsvContent, setProductCsvContent] = useState('')
  const [productPreviewRows, setProductPreviewRows] = useState<ProductImportRow[]>([])
  const [productPreviewVariants, setProductPreviewVariants] = useState<GroupedProductImport[]>([])
  const [hasVariantColumns, setHasVariantColumns] = useState(false)
  const [productValidationErrors, setProductValidationErrors] = useState<ValidationError[]>([])
  const [isImportingProducts, setIsImportingProducts] = useState(false)
  const [productImportResult, setProductImportResult] = useState<{
    type: 'basic' | 'variants'
    created: number
    updated: number
    variantsCreated?: number
    variantsUpdated?: number
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

  // Variant update state
  const [variantCsvContent, setVariantCsvContent] = useState('')
  const [variantPreviewRows, setVariantPreviewRows] = useState<VariantUpdateRow[]>([])
  const [variantOptionColumns, setVariantOptionColumns] = useState<string[]>([])
  const [isUpdatingVariants, setIsUpdatingVariants] = useState(false)
  const [variantUpdateResult, setVariantUpdateResult] = useState<{
    updated: number
    optionsUpdated: number
    skipped: number
    errors: string[]
  } | null>(null)

  // ============ PRODUCT HANDLERS (Unified) ============
  async function handleProductFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (isXLSXFile(file)) {
        // Parse XLSX file
        const rows = await readXLSXFile(file)
        const hasVariants = detectXLSXHasVariantColumns(rows)
        setHasVariantColumns(hasVariants)

        if (hasVariants) {
          const parsedRows = parseXLSXWithVariants(rows)
          const grouped = groupVariantRows(parsedRows)
          setProductPreviewVariants(grouped)
          setProductPreviewRows([])
          setProductValidationErrors([])
          // Store CSV-like content for import (convert back to use existing import logic)
          const csvContent = convertToCSVContent(rows)
          setProductCsvContent(csvContent)
        } else {
          const parsedRows = parseXLSXProducts(rows)
          const { errors } = await validateProductImport(parsedRows)
          setProductPreviewRows(parsedRows.slice(0, 10))
          setProductPreviewVariants([])
          setProductValidationErrors(errors)
          const csvContent = convertToCSVContent(rows)
          setProductCsvContent(csvContent)
        }
        setProductImportResult(null)
        toast.success('อ่านไฟล์ Excel สำเร็จ')
      } else if (isCSVFile(file)) {
        // Parse CSV file
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          setProductCsvContent(content)
          handleProductPreview(content)
        }
        reader.readAsText(file, 'UTF-8')
      } else {
        toast.error('รองรับเฉพาะไฟล์ CSV หรือ Excel (.xlsx)')
      }
    } catch (error) {
      console.error('Error reading file:', error)
      toast.error('ไม่สามารถอ่านไฟล์ได้')
    }
  }

  // Helper to convert 2D array to CSV content
  function convertToCSVContent(rows: string[][]): string {
    return rows.map(row => row.map(cell => {
      const str = String(cell ?? '')
      // Escape quotes and wrap in quotes if contains comma or quote
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')).join('\n')
  }

  async function handleProductPreview(content: string = productCsvContent) {
    // Detect if has variant columns
    const hasVariants = detectHasVariantColumns(content)
    setHasVariantColumns(hasVariants)

    if (hasVariants) {
      // Parse as variant import
      const rows = parseCSVWithVariants(content)
      const grouped = groupVariantRows(rows)
      setProductPreviewVariants(grouped)
      setProductPreviewRows([])
      setProductValidationErrors([])
    } else {
      // Parse as basic import
      const rows = parseCSV(content)
      const { errors } = await validateProductImport(rows)
      setProductPreviewRows(rows.slice(0, 10))
      setProductPreviewVariants([])
      setProductValidationErrors(errors)
    }
    setProductImportResult(null)
  }

  async function handleProductImport() {
    if (hasVariantColumns) {
      // Import with variants
      const rows = parseCSVWithVariants(productCsvContent)
      const grouped = groupVariantRows(rows)
      
      if (grouped.length === 0) {
        toast.error('ไม่พบข้อมูลที่จะนำเข้า')
        return
      }

      setIsImportingProducts(true)
      const result = await importProductsWithVariants(grouped)
      setIsImportingProducts(false)

      if (result.success) {
        setProductImportResult({
          type: 'variants',
          created: result.data.productsCreated,
          updated: result.data.productsUpdated,
          variantsCreated: result.data.variantsCreated,
          variantsUpdated: result.data.variantsUpdated,
          errors: result.data.errors,
        })
        toast.success(`นำเข้าสำเร็จ: สินค้า ${result.data.productsCreated + result.data.productsUpdated}, ตัวเลือก ${result.data.variantsCreated + result.data.variantsUpdated}`)
        if (result.data.errors.length === 0) {
          setTimeout(() => router.push('/products'), 2000)
        }
      } else {
        toast.error(result.error)
      }
    } else {
      // Basic import
      const rows = parseCSV(productCsvContent)
      if (rows.length === 0) {
        toast.error('ไม่พบข้อมูลที่จะนำเข้า')
        return
      }

      setIsImportingProducts(true)
      const result = await importProducts(rows)
      setIsImportingProducts(false)

      if (result.success) {
        setProductImportResult({
          type: 'basic',
          created: result.data.created,
          updated: result.data.updated,
          errors: result.data.errors,
        })
        toast.success(`นำเข้าสำเร็จ: สร้าง ${result.data.created}, อัปเดต ${result.data.updated}`)
        if (result.data.errors.length === 0) {
          setTimeout(() => router.push('/products'), 2000)
        }
      } else {
        toast.error(result.error)
      }
    }
  }

  function downloadBasicTemplate() {
    const template = `SKU,ชื่อสินค้า,รายละเอียด,Barcode,หมวดหมู่,หน่วย,Reorder Point,Min Qty,Max Qty,ต้นทุน
FABRIC-001,ผ้าฝ้าย 100% ขาว,ผ้าฝ้ายคุณภาพสูง,,วัตถุดิบ,M,100,50,500,85
BUTTON-001,กระดุมพลาสติก ขาว,,,วัตถุดิบ,PCS,500,100,2000,0.5`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-basic-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function downloadVariantTemplate() {
    const template = `รหัสสินค้า,ชื่อสินค้า,หมวดหมู่,หน่วย,ต้นทุน,Variant SKU,สี,ไซส์,Barcode
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-WH-S,ขาว,S,8851234567890
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-WH-M,ขาว,M,8851234567891
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-WH-L,ขาว,L,8851234567892
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-BK-S,ดำ,S,8851234567893
SHIRT-001,เสื้อยืดคอกลม Basic,เสื้อ,PCS,120,SHIRT-001-BK-M,ดำ,M,8851234567894`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-variants-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // ============ STOCK HANDLERS ============
  async function handleStockFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (isXLSXFile(file)) {
        // Parse XLSX file
        const rows = await readXLSXFile(file)
        const parsedRows = parseXLSXStock(rows)
        const { errors } = await validateStockImport(parsedRows)
        setStockPreviewRows(parsedRows.slice(0, 10))
        setStockValidationErrors(errors)
        setStockImportResult(null)
        // Convert to CSV for existing import logic
        const csvContent = convertToCSVContent(rows)
        setStockCsvContent(csvContent)
        toast.success('อ่านไฟล์ Excel สำเร็จ')
      } else if (isCSVFile(file)) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          setStockCsvContent(content)
          handleStockPreview(content)
        }
        reader.readAsText(file, 'UTF-8')
      } else {
        toast.error('รองรับเฉพาะไฟล์ CSV หรือ Excel (.xlsx)')
      }
    } catch (error) {
      console.error('Error reading file:', error)
      toast.error('ไม่สามารถอ่านไฟล์ได้')
    }
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

    const { errors } = await validateStockImport(rows)
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
SHIRT-001-WH-S,WH01/A01,100,120
SHIRT-001-WH-M,WH01/A01,80,120
FABRIC-001,WH01/B01,500,85`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'stock-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // ============ VARIANT UPDATE HANDLERS ============
  async function handleVariantFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (isXLSXFile(file)) {
        // Parse XLSX file
        const rows = await readXLSXFile(file)
        const { rows: parsedRows, optionColumns } = parseXLSXVariantUpdate(rows)
        setVariantPreviewRows(parsedRows.slice(0, 10))
        setVariantOptionColumns(optionColumns)
        setVariantUpdateResult(null)
        // Convert to CSV for existing import logic
        const csvContent = convertToCSVContent(rows)
        setVariantCsvContent(csvContent)
        toast.success('อ่านไฟล์ Excel สำเร็จ')
      } else if (isCSVFile(file)) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          setVariantCsvContent(content)
          handleVariantPreview(content)
        }
        reader.readAsText(file, 'UTF-8')
      } else {
        toast.error('รองรับเฉพาะไฟล์ CSV หรือ Excel (.xlsx)')
      }
    } catch (error) {
      console.error('Error reading file:', error)
      toast.error('ไม่สามารถอ่านไฟล์ได้')
    }
  }

  function handleVariantPreview(content: string = variantCsvContent) {
    const { rows, optionColumns } = parseVariantUpdateCSV(content)
    setVariantPreviewRows(rows.slice(0, 10))
    setVariantOptionColumns(optionColumns)
    setVariantUpdateResult(null)
  }

  async function handleVariantUpdate() {
    const { rows } = parseVariantUpdateCSV(variantCsvContent)
    if (rows.length === 0) {
      toast.error('ไม่พบข้อมูลที่จะอัปเดต')
      return
    }

    setIsUpdatingVariants(true)
    const result = await updateVariantsFromCSV(rows)
    setIsUpdatingVariants(false)

    if (result.success) {
      setVariantUpdateResult(result.data)
      const totalUpdated = result.data.updated + result.data.optionsUpdated
      toast.success(`อัปเดตสำเร็จ: ${totalUpdated} รายการ`)
      if (result.data.errors.length === 0) {
        setTimeout(() => router.push('/products'), 2000)
      }
    } else {
      toast.error(result.error)
    }
  }

  function downloadVariantUpdateTemplate() {
    const template = `SKU,Barcode,ประเภทสต๊อค,ราคาขาย,ราคาทุน,Reorder Point,Min Qty,Max Qty,แจ้งเตือน
SHIRT-001-WH-S,8851234567890,สต๊อค,140,70,10,0,0,Y
SHIRT-001-WH-M,8851234567891,สต๊อค,150,75,10,0,0,Y
SHIRT-001-BK-S,,MTO,140,70,0,0,0,N`

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'variant-update-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportCurrentVariants() {
    window.location.href = '/api/export/variants'
  }

  const totalProductRows = hasVariantColumns 
    ? productPreviewVariants.reduce((sum, p) => sum + Math.max(1, p.variants.length), 0)
    : parseCSV(productCsvContent).length

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
          <p className="text-[var(--text-muted)] mt-1">นำเข้าสินค้า สต๊อค หรืออัปเดตตัวเลือก</p>
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
            นำเข้าสินค้า
          </TabsTrigger>
          <TabsTrigger 
            value="stock" 
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-[var(--status-success)] data-[state=active]:text-white"
          >
            <Warehouse className="w-4 h-4" />
            นำเข้าสต๊อค
          </TabsTrigger>
          <TabsTrigger 
            value="update-variants" 
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-[var(--status-info)] data-[state=active]:text-white"
          >
            <RefreshCw className="w-4 h-4" />
            อัปเดตตัวเลือก
          </TabsTrigger>
        </TabsList>

        {/* ============ PRODUCT IMPORT TAB ============ */}
        <TabsContent value="products" className="space-y-6">
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">คำแนะนำ - นำเข้าสินค้า</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                ระบบจะตรวจจับอัตโนมัติว่าเป็นสินค้าพื้นฐานหรือสินค้า+ตัวเลือก
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-[var(--border-default)] rounded-lg">
                  <p className="font-medium text-[var(--text-primary)] mb-2">สินค้าพื้นฐาน (ไม่มีตัวเลือก)</p>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    เหมาะสำหรับวัตถุดิบ, อุปกรณ์ที่ไม่มีสี/ไซส์
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadBasicTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Template สินค้าพื้นฐาน
                  </Button>
                </div>
                <div className="p-4 border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 rounded-lg">
                  <p className="font-medium text-[var(--text-primary)] mb-2">สินค้า + ตัวเลือก (สี/ไซส์)</p>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    CSV ต้องมีคอลัมน์ <code>Variant SKU</code>, <code>สี</code>, <code>ไซส์</code>
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadVariantTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Template สินค้า+ตัวเลือก
                  </Button>
                </div>
              </div>
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
                  accept=".csv,.xlsx,.xls"
                  onChange={handleProductFileUpload}
                  className="hidden"
                  id="product-csv-upload"
                />
                <label
                  htmlFor="product-csv-upload"
                  className="cursor-pointer text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium"
                >
                  เลือกไฟล์ CSV / Excel
                </label>
                <p className="text-[var(--text-muted)] text-sm mt-2">หรือวางเนื้อหา CSV ด้านล่าง (Excel จะแปลงอัตโนมัติ)</p>
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

          {/* Detection Result */}
          {(productPreviewRows.length > 0 || productPreviewVariants.length > 0) && (
            <Card className={`border-2 ${hasVariantColumns ? 'border-[var(--accent-primary)]' : 'border-[var(--status-info)]'}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Badge className={hasVariantColumns ? 'bg-[var(--accent-primary)]' : 'bg-[var(--status-info)]'}>
                    {hasVariantColumns ? 'สินค้า + ตัวเลือก' : 'สินค้าพื้นฐาน'}
                  </Badge>
                  <span className="text-[var(--text-muted)]">
                    {hasVariantColumns 
                      ? `พบ ${productPreviewVariants.length} สินค้า, ${productPreviewVariants.reduce((s, p) => s + p.variants.length, 0)} ตัวเลือก`
                      : `พบ ${parseCSV(productCsvContent).length} สินค้า`
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Preview - Basic Products */}
          {productPreviewRows.length > 0 && !hasVariantColumns && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                  <span>ตัวอย่างข้อมูล (แสดง 10 รายการแรก)</span>
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
                        <TableCell className="font-mono text-[var(--accent-primary)] text-sm">{row.sku}</TableCell>
                        <TableCell className="text-[var(--text-primary)]">{row.name}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{row.categoryName || '-'}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{row.unitCode || '-'}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">{row.reorderPoint ?? '-'}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">{row.standardCost ? `฿${row.standardCost}` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Preview - Products with Variants */}
          {productPreviewVariants.length > 0 && hasVariantColumns && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                  <span>ตัวอย่างข้อมูล (แสดง 10 สินค้าแรก)</span>
                  <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">พร้อมนำเข้า</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {productPreviewVariants.slice(0, 10).map((product, idx) => (
                  <div key={idx} className="border border-[var(--border-default)] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{product.name}</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          SKU: <span className="font-mono text-[var(--accent-primary)]">{product.sku}</span>
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
                <div className={`grid gap-4 ${productImportResult.type === 'variants' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <div className="text-center p-4 bg-[var(--status-success-light)] rounded-lg border border-[var(--status-success)]/20">
                    <p className="text-2xl font-bold text-[var(--status-success)]">{productImportResult.created}</p>
                    <p className="text-sm text-[var(--text-muted)]">สินค้าสร้างใหม่</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-info)]/10 rounded-lg border border-[var(--status-info)]/20">
                    <p className="text-2xl font-bold text-[var(--status-info)]">{productImportResult.updated}</p>
                    <p className="text-sm text-[var(--text-muted)]">สินค้าอัปเดต</p>
                  </div>
                  {productImportResult.type === 'variants' && (
                    <div className="text-center p-4 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/20">
                      <p className="text-2xl font-bold text-[var(--accent-primary)]">
                        {(productImportResult.variantsCreated || 0) + (productImportResult.variantsUpdated || 0)}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">ตัวเลือก</p>
                    </div>
                  )}
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
              disabled={isImportingProducts || (productPreviewRows.length === 0 && productPreviewVariants.length === 0) || productValidationErrors.length > 0}
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
                  นำเข้าสินค้า ({totalProductRows} รายการ)
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ============ STOCK IMPORT TAB ============ */}
        <TabsContent value="stock" className="space-y-6">
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
              <Button variant="outline" onClick={downloadStockTemplate} className="border-[var(--border-default)] text-[var(--text-secondary)]">
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
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleStockFileUpload} className="hidden" id="stock-csv-upload" />
                <label htmlFor="stock-csv-upload" className="cursor-pointer text-[var(--status-success)] hover:opacity-80 font-medium">
                  เลือกไฟล์ CSV / Excel
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
                <Button onClick={() => handleStockPreview()} disabled={!stockCsvContent} variant="outline">
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
                  <span>ตัวอย่างข้อมูล</span>
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
                        <TableCell className="font-mono text-[var(--status-success)] text-sm">{row.sku}</TableCell>
                        <TableCell className="text-[var(--text-primary)]">{row.locationCode}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">{row.qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-[var(--text-secondary)]">{row.unitCost ? `฿${row.unitCost}` : '-'}</TableCell>
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

        {/* ============ UPDATE VARIANTS TAB ============ */}
        <TabsContent value="update-variants" className="space-y-6">
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">อัปเดตราคา/ข้อมูลตัวเลือกสินค้า</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                อัปเดตราคา, ประเภทสต๊อค, Reorder Point ของ Variants ที่มีอยู่แล้ว
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-[var(--status-info)]/10 border border-[var(--status-info)]/30 rounded-lg">
                <p className="text-[var(--status-info)] text-sm mb-3">
                  <strong>วิธีใช้งาน:</strong>
                </p>
                <ol className="text-sm text-[var(--text-secondary)] space-y-1 list-decimal list-inside">
                  <li>กดปุ่ม &quot;Export ข้อมูลปัจจุบัน&quot; เพื่อดาวน์โหลดไฟล์ Excel ของ Variants ทั้งหมด</li>
                  <li>เปิดไฟล์ใน Excel แล้วแก้ไขราคา/ข้อมูลที่ต้องการ</li>
                  <li>บันทึกเป็น CSV แล้วอัปโหลดกลับมา</li>
                </ol>
              </div>
              <div className="flex gap-3">
                <Button onClick={exportCurrentVariants} className="bg-[var(--status-info)]">
                  <Download className="w-4 h-4 mr-2" />
                  Export ข้อมูลปัจจุบัน
                </Button>
                <Button variant="outline" onClick={downloadVariantUpdateTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Template อัปเดต
                </Button>
              </div>

              <div className="text-sm pt-4 border-t border-[var(--border-default)]">
                <p className="text-[var(--text-primary)] font-medium mb-2">Columns ที่รองรับ:</p>
                <div className="grid grid-cols-2 gap-2 text-[var(--text-muted)]">
                  <div>
                    <li>• <code className="text-[var(--status-info)]">SKU</code> - รหัส Variant (จำเป็น)</li>
                    <li>• <code className="text-[var(--status-info)]">Barcode</code></li>
                    <li>• <code className="text-[var(--status-info)]">ประเภทสต๊อค</code> - สต๊อค/MTO/Drop</li>
                    <li>• <code className="text-[var(--status-info)]">ราคาขาย</code></li>
                  </div>
                  <div>
                    <li>• <code className="text-[var(--status-info)]">ราคาทุน</code></li>
                    <li>• <code className="text-[var(--status-info)]">Reorder Point</code></li>
                    <li>• <code className="text-[var(--status-info)]">Min/Max Qty</code></li>
                    <li>• <code className="text-[var(--status-info)]">แจ้งเตือน</code> - Y/N</li>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-[var(--accent-primary)]/10 rounded-lg">
                  <p className="text-[var(--accent-primary)] font-medium text-xs mb-1">✨ รองรับคอลัมน์ตัวเลือก (สี, ไซส์, ฯลฯ)</p>
                  <p className="text-[var(--text-muted)] text-xs">
                    ระบบจะ Export แยกคอลัมน์ตัวเลือกอัตโนมัติ สามารถแก้ไขค่าตัวเลือกใน Excel แล้ว Import กลับได้
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">อัปโหลดไฟล์ที่แก้ไขแล้ว</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center hover:border-[var(--status-info)]/50 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleVariantFileUpload} className="hidden" id="variant-csv-upload" />
                <label htmlFor="variant-csv-upload" className="cursor-pointer text-[var(--status-info)] hover:opacity-80 font-medium">
                  เลือกไฟล์ CSV / Excel
                </label>
                <p className="text-[var(--text-muted)] text-sm mt-2">หรือวางเนื้อหา CSV ด้านล่าง</p>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={variantCsvContent}
                  onChange={(e) => setVariantCsvContent(e.target.value)}
                  placeholder="SKU,Barcode,ประเภทสต๊อค,ราคาขาย,ราคาทุน,Reorder Point,แจ้งเตือน&#10;SHIRT-001-WH-S,8851234567890,สต๊อค,140,70,10,Y"
                  rows={6}
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm"
                />
                <Button onClick={() => handleVariantPreview()} disabled={!variantCsvContent} variant="outline">
                  แสดงตัวอย่าง
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {variantPreviewRows.length > 0 && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span>ตัวอย่างข้อมูล (แสดง 10 รายการแรก จากทั้งหมด {parseVariantUpdateCSV(variantCsvContent).rows.length})</span>
                    {variantOptionColumns.length > 0 && (
                      <span className="text-sm text-[var(--text-muted)] font-normal">
                        พบคอลัมน์ตัวเลือก: {variantOptionColumns.join(', ')}
                      </span>
                    )}
                  </div>
                  <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">พร้อมอัปเดต</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-default)]">
                      <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                      <TableHead className="text-[var(--text-muted)]">Barcode</TableHead>
                      <TableHead className="text-[var(--text-muted)]">ประเภท</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">ราคาขาย</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">ราคาทุน</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-right">Reorder</TableHead>
                      <TableHead className="text-[var(--text-muted)] text-center">แจ้งเตือน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantPreviewRows.map((row, idx) => (
                      <TableRow key={idx} className="border-[var(--border-default)]">
                        <TableCell className="font-mono text-[var(--status-info)] text-sm">{row.sku}</TableCell>
                        <TableCell className="font-mono text-xs text-[var(--text-muted)]">{row.barcode || '-'}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{row.stockType || '-'}</TableCell>
                        <TableCell className="text-right">{row.sellingPrice !== undefined ? `฿${row.sellingPrice}` : '-'}</TableCell>
                        <TableCell className="text-right text-[var(--text-muted)]">{row.costPrice !== undefined ? `฿${row.costPrice}` : '-'}</TableCell>
                        <TableCell className="text-right text-[var(--text-muted)]">{row.reorderPoint ?? '-'}</TableCell>
                        <TableCell className="text-center">{row.lowStockAlert || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Update Result */}
          {variantUpdateResult && (
            <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  {variantUpdateResult.errors.length === 0 ? (
                    <Check className="w-5 h-5 text-[var(--status-success)]" />
                  ) : (
                    <X className="w-5 h-5 text-[var(--status-warning)]" />
                  )}
                  ผลการอัปเดต
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-[var(--status-success-light)] rounded-lg border border-[var(--status-success)]/20">
                    <p className="text-2xl font-bold text-[var(--status-success)]">{variantUpdateResult.updated}</p>
                    <p className="text-sm text-[var(--text-muted)]">อัปเดตข้อมูล</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/20">
                    <p className="text-2xl font-bold text-[var(--accent-primary)]">{variantUpdateResult.optionsUpdated || 0}</p>
                    <p className="text-sm text-[var(--text-muted)]">อัปเดตตัวเลือก</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-default)]">
                    <p className="text-2xl font-bold text-[var(--text-muted)]">{variantUpdateResult.skipped}</p>
                    <p className="text-sm text-[var(--text-muted)]">ไม่มีการเปลี่ยนแปลง</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--status-error)]/10 rounded-lg border border-[var(--status-error)]/20">
                    <p className="text-2xl font-bold text-[var(--status-error)]">{variantUpdateResult.errors.length}</p>
                    <p className="text-sm text-[var(--text-muted)]">ข้อผิดพลาด</p>
                  </div>
                </div>
                {variantUpdateResult.errors.length > 0 && (
                  <div className="bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg p-4">
                    <p className="text-[var(--status-error)] font-medium mb-2">ข้อผิดพลาด:</p>
                    <ul className="text-sm text-[var(--status-error)]/80 space-y-1 max-h-40 overflow-y-auto">
                      {variantUpdateResult.errors.map((err, idx) => (
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
              onClick={handleVariantUpdate}
              disabled={isUpdatingVariants || variantPreviewRows.length === 0}
              className="bg-[var(--status-info)]"
            >
              {isUpdatingVariants ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังอัปเดต...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  อัปเดต ({parseVariantUpdateCSV(variantCsvContent).rows.length} รายการ)
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
