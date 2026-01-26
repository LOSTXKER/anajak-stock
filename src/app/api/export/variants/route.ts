import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const stockTypeLabels: Record<string, string> = {
  STOCKED: 'สต๊อค',
  MADE_TO_ORDER: 'MTO',
  DROP_SHIP: 'Drop',
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        active: true,
        deletedAt: null,
      },
      include: {
        product: {
          select: {
            sku: true,
            name: true,
          },
        },
        optionValues: {
          include: {
            optionValue: {
              include: {
                optionType: true,
              },
            },
          },
        },
        stockBalances: true,
      },
      orderBy: [
        { product: { sku: 'asc' } },
        { sku: 'asc' },
      ],
    })

    // Transform to Excel format
    const rows = variants.map((variant) => {
      const totalStock = variant.stockBalances.reduce(
        (sum, sb) => sum + Number(sb.qtyOnHand),
        0
      )

      // Get option values
      const options = variant.optionValues
        .map(ov => `${ov.optionValue.optionType.name}: ${ov.optionValue.value}`)
        .join(', ')

      return {
        'รหัสสินค้า': variant.product.sku,
        'ชื่อสินค้า': variant.product.name,
        'SKU': variant.sku,
        'Barcode': variant.barcode || '',
        'ตัวเลือก': options,
        'ประเภทสต๊อค': stockTypeLabels[variant.stockType] || variant.stockType,
        'ราคาขาย': Number(variant.sellingPrice),
        'ราคาทุน': Number(variant.costPrice),
        'Reorder Point': Number(variant.reorderPoint),
        'Min Qty': Number(variant.minQty),
        'Max Qty': Number(variant.maxQty),
        'สต๊อค': totalStock,
        'แจ้งเตือน': variant.lowStockAlert ? 'Y' : 'N',
      }
    })

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    ws['!cols'] = [
      { wch: 15 },  // รหัสสินค้า
      { wch: 30 },  // ชื่อสินค้า
      { wch: 18 },  // SKU
      { wch: 15 },  // Barcode
      { wch: 25 },  // ตัวเลือก
      { wch: 12 },  // ประเภทสต๊อค
      { wch: 10 },  // ราคาขาย
      { wch: 10 },  // ราคาทุน
      { wch: 12 },  // Reorder Point
      { wch: 10 },  // Min Qty
      { wch: 10 },  // Max Qty
      { wch: 10 },  // สต๊อค
      { wch: 10 },  // แจ้งเตือน
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Variants')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="variants-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export variants error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
