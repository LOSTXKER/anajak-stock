'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getCachedCategories, getCachedWarehouses } from '@/lib/cache'

// ===== Types =====

interface RawStockRow {
  productId: string
  variantId: string | null
  locationId: string
  productSku: string
  productName: string
  standardCost: unknown
  variantSku: string | null
  variantName: string | null
  variantCost: unknown
  locationCode: string
  warehouseName: string
  warehouseId: string
  categoryName: string | null
  categoryId: string | null
  qtyOnHand: unknown
}

interface RawSummaryRow {
  skuCount: bigint
  totalQty: unknown
  totalValue: unknown
}

export interface MonthEndStockItem {
  productId: string
  sku: string
  name: string
  category: string | null
  categoryId: string | null
  variantName: string | null
  locationCode: string
  warehouseName: string
  warehouseId: string
  qtyOnHand: number
  unitCost: number
  stockValue: number
}

export interface MonthEndSummary {
  totalSKUs: number
  totalQty: number
  totalValue: number
}

export interface TrendDataPoint {
  month: string
  label: string
  totalValue: number
  totalQty: number
  skuCount: number
}

// ===== Helpers =====

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function getMonthCutoff(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1))
}

function getThaiMonthLabel(year: number, month: number): string {
  const thaiYear = (year + 543) % 100
  return `${THAI_MONTHS[month - 1]} ${thaiYear.toString().padStart(2, '0')}`
}

function transformRawRows(rows: RawStockRow[]): MonthEndStockItem[] {
  return rows.map((row) => {
    const qtyOnHand = Number(row.qtyOnHand)
    const unitCost = Number(row.variantCost || row.standardCost || 0)
    return {
      productId: row.productId,
      sku: row.variantSku || row.productSku,
      name: row.productName,
      category: row.categoryName,
      categoryId: row.categoryId,
      variantName: row.variantName,
      locationCode: row.locationCode,
      warehouseName: row.warehouseName,
      warehouseId: row.warehouseId,
      qtyOnHand,
      unitCost,
      stockValue: qtyOnHand * unitCost,
    }
  })
}

function computeSummary(items: MonthEndStockItem[]): MonthEndSummary {
  return {
    totalSKUs: new Set(items.map((i) => i.productId)).size,
    totalQty: items.reduce((sum, i) => sum + i.qtyOnHand, 0),
    totalValue: items.reduce((sum, i) => sum + i.stockValue, 0),
  }
}

// ===== Core SQL Queries =====

// CTE fragment shared by detail and summary queries.
// Uses a single date filter on the base posted_lines CTE,
// then fans out by movement type in movement_effects.
const MOVEMENT_EFFECTS_CTE = `
  WITH posted_lines AS (
    SELECT
      ml."productId",
      ml."variantId",
      ml."fromLocationId",
      ml."toLocationId",
      ml.qty,
      sm.type
    FROM movement_lines ml
    JOIN stock_movements sm ON ml."movementId" = sm.id
    WHERE sm.status = 'POSTED'
      AND sm."postedAt" < $1
  ),
  movement_effects AS (
    SELECT "productId", "variantId", "toLocationId" AS "locationId", qty
    FROM posted_lines
    WHERE type IN ('RECEIVE', 'RETURN') AND "toLocationId" IS NOT NULL

    UNION ALL

    SELECT "productId", "variantId", "fromLocationId", -qty
    FROM posted_lines
    WHERE type = 'ISSUE' AND "fromLocationId" IS NOT NULL

    UNION ALL

    SELECT "productId", "variantId", "fromLocationId", -qty
    FROM posted_lines
    WHERE type = 'TRANSFER' AND "fromLocationId" IS NOT NULL

    UNION ALL

    SELECT "productId", "variantId", "toLocationId", qty
    FROM posted_lines
    WHERE type = 'TRANSFER' AND "toLocationId" IS NOT NULL

    UNION ALL

    SELECT "productId", "variantId", "toLocationId", qty
    FROM posted_lines
    WHERE type = 'ADJUST' AND "toLocationId" IS NOT NULL
  )
`

async function getStockDetailAtDate(cutoffDate: Date): Promise<RawStockRow[]> {
  const sql = `
    ${MOVEMENT_EFFECTS_CTE}
    SELECT
      me."productId",
      me."variantId",
      me."locationId",
      p.sku        AS "productSku",
      p.name       AS "productName",
      p."standardCost",
      pv.sku       AS "variantSku",
      pv.name      AS "variantName",
      pv."costPrice" AS "variantCost",
      l.code       AS "locationCode",
      w.name       AS "warehouseName",
      w.id         AS "warehouseId",
      c.name       AS "categoryName",
      c.id         AS "categoryId",
      SUM(me.qty)  AS "qtyOnHand"
    FROM movement_effects me
    JOIN products p           ON me."productId" = p.id
    LEFT JOIN product_variants pv ON me."variantId" = pv.id
    JOIN locations l           ON me."locationId" = l.id
    JOIN warehouses w          ON l."warehouseId" = w.id
    LEFT JOIN categories c     ON p."categoryId" = c.id
    WHERE p.active = true AND p."deletedAt" IS NULL
    GROUP BY
      me."productId", me."variantId", me."locationId",
      p.sku, p.name, p."standardCost",
      pv.sku, pv.name, pv."costPrice",
      l.code, w.name, w.id,
      c.name, c.id
    HAVING SUM(me.qty) != 0
    ORDER BY p.sku ASC, pv.sku ASC NULLS FIRST, l.code ASC
  `
  return prisma.$queryRawUnsafe<RawStockRow[]>(sql, cutoffDate)
}

async function getStockSummaryAtDate(cutoffDate: Date): Promise<MonthEndSummary> {
  const sql = `
    ${MOVEMENT_EFFECTS_CTE},
    stock_by_item AS (
      SELECT me."productId", me."variantId", SUM(me.qty) AS qty
      FROM movement_effects me
      GROUP BY me."productId", me."variantId"
      HAVING SUM(me.qty) != 0
    )
    SELECT
      COUNT(DISTINCT si."productId")::bigint AS "skuCount",
      COALESCE(SUM(si.qty), 0)               AS "totalQty",
      COALESCE(SUM(
        si.qty * COALESCE(pv."costPrice", p."standardCost", 0)
      ), 0)                                   AS "totalValue"
    FROM stock_by_item si
    JOIN products p            ON si."productId" = p.id
    LEFT JOIN product_variants pv ON si."variantId" = pv.id
    WHERE p.active = true AND p."deletedAt" IS NULL
  `
  const result = await prisma.$queryRawUnsafe<RawSummaryRow[]>(sql, cutoffDate)
  const row = result[0]
  return {
    totalSKUs: Number(row?.skuCount ?? 0),
    totalQty: Number(row?.totalQty ?? 0),
    totalValue: Number(row?.totalValue ?? 0),
  }
}

// ===== Public Server Actions =====

export async function getMonthEndStock(year: number, month: number) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const cutoffDate = getMonthCutoff(year, month)

    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevCutoffDate = getMonthCutoff(prevYear, prevMonth)

    const [rawRows, prevSummary, categories, warehouses] = await Promise.all([
      getStockDetailAtDate(cutoffDate),
      getStockSummaryAtDate(prevCutoffDate),
      getCachedCategories(),
      getCachedWarehouses(),
    ])

    const items = transformRawRows(rawRows)
    const summary = computeSummary(items)

    return {
      success: true as const,
      data: {
        items,
        summary,
        prevSummary,
        categories,
        warehouses,
        month,
        year,
      },
    }
  } catch (error) {
    console.error('Error getting month-end stock:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function getMonthlyStockTrend(months: number = 6) {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const promises = Array.from({ length: months }, (_, i) => {
      let m = currentMonth - i
      let y = currentYear
      while (m <= 0) {
        m += 12
        y -= 1
      }
      const cutoff = getMonthCutoff(y, m)
      const monthStr = `${y}-${m.toString().padStart(2, '0')}`
      const label = getThaiMonthLabel(y, m)
      return getStockSummaryAtDate(cutoff).then((s) => ({
        month: monthStr,
        label,
        totalValue: s.totalValue,
        totalQty: s.totalQty,
        skuCount: s.totalSKUs,
      }))
    })

    const results = await Promise.all(promises)
    results.reverse()

    return { success: true as const, data: results }
  } catch (error) {
    console.error('Error getting stock trend:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function exportMonthEndStockCSV(
  year: number,
  month: number,
  filters?: { search?: string; categoryId?: string; warehouseId?: string }
) {
  const session = await getSession()
  if (!session) {
    throw new Error('กรุณาเข้าสู่ระบบ')
  }

  try {
    const cutoffDate = getMonthCutoff(year, month)
    const rawRows = await getStockDetailAtDate(cutoffDate)
    let items = transformRawRows(rawRows)

    if (filters?.search) {
      const s = filters.search.toLowerCase()
      items = items.filter(
        (i) => i.sku.toLowerCase().includes(s) || i.name.toLowerCase().includes(s)
      )
    }
    if (filters?.categoryId) {
      items = items.filter((i) => i.categoryId === filters.categoryId)
    }
    if (filters?.warehouseId) {
      items = items.filter((i) => i.warehouseId === filters.warehouseId)
    }

    const label = getThaiMonthLabel(year, month)
    const totalQty = items.reduce((s, i) => s + i.qtyOnHand, 0)
    const totalValue = items.reduce((s, i) => s + i.stockValue, 0)

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`

    const headers = [
      'SKU', 'ชื่อสินค้า', 'ตัวเลือก', 'หมวดหมู่',
      'คลังสินค้า', 'ตำแหน่ง', 'คงเหลือ', 'ต้นทุน/หน่วย', 'มูลค่า',
    ]

    const rows = items.map((i) => [
      esc(i.sku), esc(i.name), esc(i.variantName || ''), esc(i.category || ''),
      esc(i.warehouseName), esc(i.locationCode),
      i.qtyOnHand, i.unitCost, i.stockValue,
    ])

    return [
      `สต็อคคงเหลือ ณ สิ้นเดือน ${label}`,
      `วันที่ออกรายงาน,${new Date().toLocaleDateString('th-TH')}`,
      '',
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      '',
      `รวมทั้งหมด,,,,,,${totalQty},,${totalValue}`,
    ].join('\n')
  } catch (error) {
    console.error('Error exporting month-end stock:', error)
    throw new Error('เกิดข้อผิดพลาดในการ Export')
  }
}
