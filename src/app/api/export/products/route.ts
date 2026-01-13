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
    const products = await prisma.product.findMany({
      where: {
        active: true,
        deletedAt: null,
      },
      include: {
        category: true,
        unit: true,
        stockBalances: true,
      },
      orderBy: { sku: 'asc' },
    })

    // Transform to Excel format
    const rows = products.map((product) => {
      const totalStock = product.stockBalances.reduce(
        (sum, sb) => sum + Number(sb.qtyOnHand),
        0
      )
      return {
        SKU: product.sku,
        ชื่อสินค้า: product.name,
        รายละเอียด: product.description || '-',
        Barcode: product.barcode || '-',
        หมวดหมู่: product.category?.name || '-',
        หน่วย: product.unit?.name || '-',
        คงเหลือ: totalStock,
        'Reorder Point': Number(product.reorderPoint),
        'Min Qty': Number(product.minQty),
        'Max Qty': Number(product.maxQty),
        ต้นทุน: Number(product.standardCost),
        มูลค่า: totalStock * Number(product.standardCost),
        สถานะ: product.active ? 'ใช้งาน' : 'ปิดใช้งาน',
      }
    })

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Products')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export products error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
