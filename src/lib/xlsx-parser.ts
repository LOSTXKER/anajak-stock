// XLSX parsing utilities for client-side use
import * as XLSX from 'xlsx'
import type {
  ProductImportRow,
  ProductVariantImportRow,
  VariantUpdateRow,
  VariantUpdateParseResult,
} from './csv-parser'

/**
 * Read XLSX file and convert to array of arrays
 */
export function readXLSXFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        resolve(rows)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse XLSX for basic product import
 */
export function parseXLSXProducts(rows: string[][]): ProductImportRow[] {
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => String(h).trim().toLowerCase())

  // Map headers to fields
  const headerMap: Record<string, keyof ProductImportRow> = {
    sku: 'sku',
    'ชื่อสินค้า': 'name',
    name: 'name',
    'รายละเอียด': 'description',
    description: 'description',
    barcode: 'barcode',
    'หมวดหมู่': 'categoryName',
    category: 'categoryName',
    categoryname: 'categoryName',
    'หน่วย': 'unitCode',
    unit: 'unitCode',
    unitcode: 'unitCode',
    'reorder point': 'reorderPoint',
    reorderpoint: 'reorderPoint',
    rop: 'reorderPoint',
    'min qty': 'minQty',
    minqty: 'minQty',
    'max qty': 'maxQty',
    maxqty: 'maxQty',
    'ต้นทุน': 'standardCost',
    'ต้นทุนมาตรฐาน': 'standardCost',
    cost: 'standardCost',
    standardcost: 'standardCost',
  }

  const columnIndices: Record<keyof ProductImportRow, number> = {} as Record<keyof ProductImportRow, number>

  headers.forEach((header, index) => {
    const field = headerMap[header]
    if (field) {
      columnIndices[field] = index
    }
  })

  const result: ProductImportRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].map((v) => String(v ?? '').trim())

    const getValue = (field: keyof ProductImportRow): string | undefined => {
      const idx = columnIndices[field]
      return idx !== undefined ? values[idx] || undefined : undefined
    }

    const getNumber = (field: keyof ProductImportRow): number | undefined => {
      const val = getValue(field)
      if (!val) return undefined
      const num = parseFloat(val)
      return isNaN(num) ? undefined : num
    }

    const row: ProductImportRow = {
      sku: getValue('sku') || '',
      name: getValue('name') || '',
      description: getValue('description'),
      barcode: getValue('barcode'),
      categoryName: getValue('categoryName'),
      unitCode: getValue('unitCode'),
      reorderPoint: getNumber('reorderPoint'),
      minQty: getNumber('minQty'),
      maxQty: getNumber('maxQty'),
      standardCost: getNumber('standardCost'),
    }

    if (row.sku && row.name) {
      result.push(row)
    }
  }

  return result
}

/**
 * Parse XLSX with variants support
 */
export function parseXLSXWithVariants(rows: string[][]): ProductVariantImportRow[] {
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => String(h).trim().toLowerCase())

  // Map headers to fields
  const headerMap: Record<string, keyof ProductVariantImportRow> = {
    // Product fields
    sku: 'sku',
    'รหัสสินค้า': 'sku',
    'ชื่อสินค้า': 'name',
    name: 'name',
    'รายละเอียด': 'description',
    description: 'description',
    'หมวดหมู่': 'categoryName',
    category: 'categoryName',
    categoryname: 'categoryName',
    'หน่วย': 'unitCode',
    unit: 'unitCode',
    unitcode: 'unitCode',
    'reorder point': 'reorderPoint',
    reorderpoint: 'reorderPoint',
    rop: 'reorderPoint',
    'ต้นทุน': 'standardCost',
    'ราคาทุน': 'standardCost',
    cost: 'standardCost',
    standardcost: 'standardCost',
    // Variant fields
    'variant sku': 'variantSku',
    variantsku: 'variantSku',
    'รหัส variant': 'variantSku',
    'สี': 'color',
    color: 'color',
    'ไซส์': 'size',
    size: 'size',
    barcode: 'variantBarcode',
    'variant barcode': 'variantBarcode',
    variantbarcode: 'variantBarcode',
    'ต้นทุน variant': 'variantCost',
    variantcost: 'variantCost',
    // Selling price
    'ราคาขาย': 'variantSellingPrice',
    'ราคาขาย variant': 'variantSellingPrice',
    sellingprice: 'variantSellingPrice',
    'selling price': 'variantSellingPrice',
    variantsellingprice: 'variantSellingPrice',
  }

  const columnIndices: Partial<Record<keyof ProductVariantImportRow, number>> = {}

  headers.forEach((header, index) => {
    const field = headerMap[header]
    if (field) {
      columnIndices[field] = index
    }
  })

  const result: ProductVariantImportRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].map((v) => String(v ?? '').trim())

    const getValue = (field: keyof ProductVariantImportRow): string | undefined => {
      const idx = columnIndices[field]
      return idx !== undefined ? values[idx] || undefined : undefined
    }

    const getNumber = (field: keyof ProductVariantImportRow): number | undefined => {
      const val = getValue(field)
      if (!val) return undefined
      const num = parseFloat(val)
      return isNaN(num) ? undefined : num
    }

    const row: ProductVariantImportRow = {
      sku: getValue('sku') || '',
      name: getValue('name') || '',
      description: getValue('description'),
      categoryName: getValue('categoryName'),
      unitCode: getValue('unitCode'),
      reorderPoint: getNumber('reorderPoint'),
      standardCost: getNumber('standardCost'),
      variantSku: getValue('variantSku'),
      color: getValue('color'),
      size: getValue('size'),
      variantBarcode: getValue('variantBarcode'),
      variantCost: getNumber('variantCost'),
      variantSellingPrice: getNumber('variantSellingPrice'),
    }

    if (row.sku && row.name) {
      result.push(row)
    }
  }

  return result
}

/**
 * Detect if XLSX has variant columns
 */
export function detectXLSXHasVariantColumns(rows: string[][]): boolean {
  if (rows.length < 1) return false

  const headers = rows[0].map((h) => String(h).trim().toLowerCase())
  const variantKeywords = ['variant sku', 'variantsku', 'รหัส variant', 'สี', 'color', 'ไซส์', 'size']

  return variantKeywords.some((keyword) => headers.includes(keyword))
}

/**
 * Parse XLSX for variant update
 */
const KNOWN_COLUMNS = new Set([
  'sku', 'variant sku', 'variantsku', 'รหัส variant',
  'barcode',
  'ประเภทสต๊อค', 'ประเภท', 'stocktype', 'stock type',
  'ราคาขาย', 'sellingprice', 'selling price',
  'ราคาทุน', 'costprice', 'cost price',
  'reorder point', 'reorderpoint', 'reorder',
  'min qty', 'minqty', 'min',
  'max qty', 'maxqty', 'max',
  'แจ้งเตือน', 'alert', 'lowstockalert',
  // Non-editable columns (ignored)
  'รหัสสินค้า', 'ชื่อสินค้า', 'สต๊อค', 'stock',
])

export function parseXLSXVariantUpdate(rows: string[][]): VariantUpdateParseResult {
  if (rows.length < 2) {
    return { rows: [], optionColumns: [] }
  }

  const rawHeaders = rows[0].map((h) => String(h ?? '').trim())
  const headers = rawHeaders.map((h) => h.toLowerCase())

  // Map headers to fields
  const headerMap: Record<string, keyof Omit<VariantUpdateRow, 'options'>> = {
    sku: 'sku',
    'variant sku': 'sku',
    variantsku: 'sku',
    'รหัส variant': 'sku',
    barcode: 'barcode',
    'ประเภทสต๊อค': 'stockType',
    'ประเภท': 'stockType',
    stocktype: 'stockType',
    'stock type': 'stockType',
    'ราคาขาย': 'sellingPrice',
    sellingprice: 'sellingPrice',
    'selling price': 'sellingPrice',
    'ราคาทุน': 'costPrice',
    costprice: 'costPrice',
    'cost price': 'costPrice',
    'reorder point': 'reorderPoint',
    reorderpoint: 'reorderPoint',
    reorder: 'reorderPoint',
    'min qty': 'minQty',
    minqty: 'minQty',
    min: 'minQty',
    'max qty': 'maxQty',
    maxqty: 'maxQty',
    max: 'maxQty',
    'แจ้งเตือน': 'lowStockAlert',
    alert: 'lowStockAlert',
    lowstockalert: 'lowStockAlert',
  }

  const columnIndices: Partial<Record<keyof Omit<VariantUpdateRow, 'options'>, number>> = {}

  // Detect option columns
  const optionColumnIndices: { index: number; name: string }[] = []

  headers.forEach((header, index) => {
    const field = headerMap[header]
    if (field) {
      columnIndices[field] = index
    } else if (!KNOWN_COLUMNS.has(header) && rawHeaders[index].trim()) {
      optionColumnIndices.push({ index, name: rawHeaders[index].trim() })
    }
  })

  const optionColumns = optionColumnIndices.map((oc) => oc.name)

  const result: VariantUpdateRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].map((v) => String(v ?? '').trim())

    const getValue = (field: keyof Omit<VariantUpdateRow, 'options'>): string | undefined => {
      const idx = columnIndices[field]
      return idx !== undefined ? values[idx] || undefined : undefined
    }

    const getNumber = (field: keyof Omit<VariantUpdateRow, 'options'>): number | undefined => {
      const val = getValue(field)
      if (!val) return undefined
      const num = parseFloat(val)
      return isNaN(num) ? undefined : num
    }

    const sku = getValue('sku')
    if (!sku) continue

    // Parse option columns
    const options: Record<string, string> = {}
    optionColumnIndices.forEach(({ index, name }) => {
      const value = values[index]
      if (value) {
        options[name] = value
      }
    })

    const row: VariantUpdateRow = {
      sku,
      barcode: getValue('barcode'),
      stockType: getValue('stockType'),
      sellingPrice: getNumber('sellingPrice'),
      costPrice: getNumber('costPrice'),
      reorderPoint: getNumber('reorderPoint'),
      minQty: getNumber('minQty'),
      maxQty: getNumber('maxQty'),
      lowStockAlert: getValue('lowStockAlert'),
      options: Object.keys(options).length > 0 ? options : undefined,
    }

    result.push(row)
  }

  return { rows: result, optionColumns }
}

/**
 * Parse stock import from XLSX
 */
export interface StockImportRow {
  sku: string
  locationCode: string
  qty: number
  unitCost?: number
}

export function parseXLSXStock(rows: string[][]): StockImportRow[] {
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => String(h).trim().toLowerCase())

  // Find column indices
  const skuIdx = headers.findIndex((h) => h === 'sku' || h === 'รหัสสินค้า')
  const locationIdx = headers.findIndex((h) => h === 'ตำแหน่ง' || h === 'location' || h === 'locationcode')
  const qtyIdx = headers.findIndex((h) => h === 'จำนวน' || h === 'qty' || h === 'quantity')
  const costIdx = headers.findIndex((h) => h === 'ราคาทุน' || h === 'unitcost' || h === 'cost')

  if (skuIdx === -1 || locationIdx === -1 || qtyIdx === -1) {
    return []
  }

  const result: StockImportRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].map((v) => String(v ?? '').trim())

    const sku = values[skuIdx]
    const locationCode = values[locationIdx]
    const qty = parseFloat(values[qtyIdx]) || 0
    const unitCost = costIdx !== -1 ? parseFloat(values[costIdx]) || undefined : undefined

    if (sku && locationCode) {
      result.push({ sku, locationCode, qty, unitCost })
    }
  }

  return result
}

/**
 * Check if file is XLSX
 */
export function isXLSXFile(file: File): boolean {
  const xlsxTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  const xlsxExtensions = ['.xlsx', '.xls']

  return xlsxTypes.includes(file.type) || xlsxExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
}

/**
 * Check if file is CSV
 */
export function isCSVFile(file: File): boolean {
  return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
}
