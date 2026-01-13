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
