'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getCachedCategories, getCachedWarehouses } from '@/lib/cache'

interface StockReportFilters {
  search?: string
  categoryId?: string
  warehouseId?: string
  showZero?: boolean
}

export async function getStockReport() {
  const session = await getSession()
  if (!session) {
    return { success: false as const, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    // Get all stock balances with related data
    // Use select to reduce data size
    const stockBalances = await prisma.stockBalance.findMany({
      select: {
        productId: true,
        qtyOnHand: true,
        qtyReserved: true,
        product: {
          select: {
            sku: true,
            name: true,
            standardCost: true,
            category: { select: { name: true } },
          },
        },
        variant: {
          select: {
            sku: true,
            name: true,
            costPrice: true,
          },
        },
        location: {
          select: {
            code: true,
            warehouse: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { product: { sku: 'asc' } },
        { location: { code: 'asc' } },
      ],
    })

    // Get categories and warehouses from cache
    const [categories, warehouses] = await Promise.all([
      getCachedCategories(),
      getCachedWarehouses(),
    ])

    // Transform data
    const items = stockBalances.map((sb) => ({
      productId: sb.productId,
      sku: sb.variant?.sku || sb.product.sku,
      name: sb.product.name,
      category: sb.product.category?.name || null,
      variantName: sb.variant?.name || null,
      locationCode: sb.location.code,
      warehouseName: sb.location.warehouse.name,
      qtyOnHand: Number(sb.qtyOnHand),
      qtyReserved: Number(sb.qtyReserved),
      qtyAvailable: Number(sb.qtyOnHand) - Number(sb.qtyReserved),
      unitCost: Number(sb.variant?.costPrice || sb.product.standardCost || 0),
      stockValue: Number(sb.qtyOnHand) * Number(sb.variant?.costPrice || sb.product.standardCost || 0),
    }))

    return {
      success: true as const,
      data: {
        items,
        categories,
        warehouses,
      },
    }
  } catch (error) {
    console.error('Error getting stock report:', error)
    return { success: false as const, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }
  }
}

export async function exportStockReportToCSV(filters: StockReportFilters) {
  const session = await getSession()
  if (!session) {
    throw new Error('กรุณาเข้าสู่ระบบ')
  }

  try {
    // Get stock data
    const result = await getStockReport()
    if (!result.success) {
      throw new Error(result.error)
    }

    let items = result.data.items

    // Apply filters
    if (filters.search) {
      const search = filters.search.toLowerCase()
      items = items.filter(
        (item) =>
          item.sku.toLowerCase().includes(search) ||
          item.name.toLowerCase().includes(search)
      )
    }

    if (filters.categoryId) {
      const category = result.data.categories.find((c) => c.id === filters.categoryId)
      if (category) {
        items = items.filter((item) => item.category === category.name)
      }
    }

    if (filters.warehouseId) {
      const warehouse = result.data.warehouses.find((w) => w.id === filters.warehouseId)
      if (warehouse) {
        items = items.filter((item) => item.warehouseName === warehouse.name)
      }
    }

    if (!filters.showZero) {
      items = items.filter((item) => item.qtyOnHand > 0)
    }

    // Generate CSV
    const headers = [
      'SKU',
      'ชื่อสินค้า',
      'ตัวเลือก',
      'หมวดหมู่',
      'คลังสินค้า',
      'ตำแหน่ง',
      'คงเหลือ',
      'จอง',
      'พร้อมใช้',
      'ต้นทุน/หน่วย',
      'มูลค่า',
    ]

    const rows = items.map((item) => [
      item.sku,
      item.name,
      item.variantName || '',
      item.category || '',
      item.warehouseName,
      item.locationCode,
      item.qtyOnHand,
      item.qtyReserved,
      item.qtyAvailable,
      item.unitCost,
      item.stockValue,
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    return csv
  } catch (error) {
    console.error('Error exporting stock report:', error)
    throw new Error('เกิดข้อผิดพลาดในการ Export')
  }
}
