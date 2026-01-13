import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stockData = await prisma.stockBalance.findMany({
      include: {
        product: {
          include: {
            category: true,
            unit: true,
          },
        },
        location: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: [
        { location: { warehouse: { name: 'asc' } } },
        { product: { sku: 'asc' } },
      ],
    })

    // Transform to Excel format
    const rows = stockData.map((item) => ({
      คลัง: item.location.warehouse.name,
      โลเคชัน: item.location.code,
      SKU: item.product.sku,
      ชื่อสินค้า: item.product.name,
      หมวดหมู่: item.product.category?.name || '-',
      จำนวน: Number(item.qtyOnHand),
      หน่วย: item.product.unit?.name || '-',
      ต้นทุน: Number(item.product.standardCost),
      มูลค่า: Number(item.qtyOnHand) * Number(item.product.standardCost),
      'Reorder Point': Number(item.product.reorderPoint),
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    ws['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Stock Report')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stock-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export stock error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
