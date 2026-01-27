// CSV parsing utilities for client-side use

export interface ProductImportRow {
  sku: string
  name: string
  description?: string
  barcode?: string
  categoryName?: string
  unitCode?: string
  reorderPoint?: number
  minQty?: number
  maxQty?: number
  standardCost?: number
}

// New: Product with Variants import
export interface ProductVariantImportRow {
  // Product fields
  sku: string
  name: string
  description?: string
  categoryName?: string
  unitCode?: string
  reorderPoint?: number
  standardCost?: number
  // Variant fields
  variantSku?: string
  color?: string
  size?: string
  variantBarcode?: string
  variantCost?: number
}

export function parseCSV(csvContent: string): ProductImportRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim())

  if (lines.length < 2) {
    return []
  }

  // Parse header
  const headerLine = lines[0]
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())

  // Map headers to our fields
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

  // Parse rows
  const rows: ProductImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = parseCSVLine(line)

    const row: ProductImportRow = {
      sku: values[columnIndices.sku] || '',
      name: values[columnIndices.name] || '',
      description: values[columnIndices.description],
      barcode: values[columnIndices.barcode],
      categoryName: values[columnIndices.categoryName],
      unitCode: values[columnIndices.unitCode],
      reorderPoint: columnIndices.reorderPoint !== undefined ? parseFloat(values[columnIndices.reorderPoint]) || 0 : undefined,
      minQty: columnIndices.minQty !== undefined ? parseFloat(values[columnIndices.minQty]) || 0 : undefined,
      maxQty: columnIndices.maxQty !== undefined ? parseFloat(values[columnIndices.maxQty]) || 0 : undefined,
      standardCost: columnIndices.standardCost !== undefined ? parseFloat(values[columnIndices.standardCost]) || 0 : undefined,
    }

    if (row.sku && row.name) {
      rows.push(row)
    }
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

/**
 * Parse CSV with Variants support
 * Format: SKU, ชื่อสินค้า, หมวดหมู่, สี, ไซส์, Variant SKU, Barcode, ราคาทุน
 */
export function parseCSVWithVariants(csvContent: string): ProductVariantImportRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim())

  if (lines.length < 2) {
    return []
  }

  // Parse header
  const headerLine = lines[0]
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())

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
    'barcode': 'variantBarcode',
    'variant barcode': 'variantBarcode',
    variantbarcode: 'variantBarcode',
    'ต้นทุน variant': 'variantCost',
    variantcost: 'variantCost',
  }

  const columnIndices: Partial<Record<keyof ProductVariantImportRow, number>> = {}

  headers.forEach((header, index) => {
    const field = headerMap[header]
    if (field) {
      columnIndices[field] = index
    }
  })

  // Parse rows
  const rows: ProductVariantImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = parseCSVLine(line)

    const getValue = (field: keyof ProductVariantImportRow): string | undefined => {
      const idx = columnIndices[field]
      return idx !== undefined ? values[idx]?.trim() : undefined
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
    }

    // Must have SKU and name
    if (row.sku && row.name) {
      rows.push(row)
    }
  }

  return rows
}

/**
 * Group variant rows by product SKU
 */
export interface GroupedProductImport {
  sku: string
  name: string
  description?: string
  categoryName?: string
  unitCode?: string
  reorderPoint?: number
  standardCost?: number
  variants: Array<{
    variantSku: string
    color?: string
    size?: string
    barcode?: string
    cost?: number
  }>
}

export function groupVariantRows(rows: ProductVariantImportRow[]): GroupedProductImport[] {
  const productMap = new Map<string, GroupedProductImport>()

  for (const row of rows) {
    if (!productMap.has(row.sku)) {
      productMap.set(row.sku, {
        sku: row.sku,
        name: row.name,
        description: row.description,
        categoryName: row.categoryName,
        unitCode: row.unitCode,
        reorderPoint: row.reorderPoint,
        standardCost: row.standardCost,
        variants: [],
      })
    }

    const product = productMap.get(row.sku)!

    // If has variant info, add to variants
    if (row.variantSku || row.color || row.size) {
      product.variants.push({
        variantSku: row.variantSku || `${row.sku}-${row.color || ''}-${row.size || ''}`.replace(/--/g, '-').replace(/-$/, ''),
        color: row.color,
        size: row.size,
        barcode: row.variantBarcode,
        cost: row.variantCost ?? row.standardCost,
      })
    }
  }

  return Array.from(productMap.values())
}

/**
 * Detect if CSV has variant columns (สี, ไซส์, Variant SKU)
 */
export function detectHasVariantColumns(csvContent: string): boolean {
  const lines = csvContent.split('\n').filter((line) => line.trim())
  if (lines.length < 1) return false

  const headerLine = lines[0].toLowerCase()
  const variantKeywords = ['variant sku', 'variantsku', 'รหัส variant', 'สี', 'color', 'ไซส์', 'size']
  
  return variantKeywords.some(keyword => headerLine.includes(keyword))
}

/**
 * Parse CSV for variant update (update existing variants)
 */
export interface VariantUpdateRow {
  sku: string
  barcode?: string
  stockType?: string
  sellingPrice?: number
  costPrice?: number
  reorderPoint?: number
  minQty?: number
  maxQty?: number
  lowStockAlert?: string
  // Dynamic option columns - key is option type name (e.g., "สี", "ไซส์")
  options?: Record<string, string>
}

// Known column names that are NOT option columns
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

export interface VariantUpdateParseResult {
  rows: VariantUpdateRow[]
  optionColumns: string[]  // List of detected option column names
}

export function parseVariantUpdateCSV(csvContent: string): VariantUpdateParseResult {
  const lines = csvContent.split('\n').filter((line) => line.trim())

  if (lines.length < 2) {
    return { rows: [], optionColumns: [] }
  }

  // Parse header
  const headerLine = lines[0]
  const rawHeaders = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const headers = rawHeaders.map(h => h.toLowerCase())

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
  
  // Detect option columns (columns that are not in KNOWN_COLUMNS)
  const optionColumnIndices: { index: number; name: string }[] = []

  headers.forEach((header, index) => {
    const field = headerMap[header]
    if (field) {
      columnIndices[field] = index
    } else if (!KNOWN_COLUMNS.has(header) && rawHeaders[index].trim()) {
      // This is likely an option column (สี, ไซส์, etc.)
      optionColumnIndices.push({ index, name: rawHeaders[index].trim() })
    }
  })

  const optionColumns = optionColumnIndices.map(oc => oc.name)

  // Parse rows
  const rows: VariantUpdateRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = parseCSVLine(line)

    const getValue = (field: keyof Omit<VariantUpdateRow, 'options'>): string | undefined => {
      const idx = columnIndices[field]
      return idx !== undefined ? values[idx]?.trim() : undefined
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
      const value = values[index]?.trim()
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

    rows.push(row)
  }

  return { rows, optionColumns }
}

