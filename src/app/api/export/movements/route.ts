import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  try {
    const movements = await prisma.movementLine.findMany({
      where: {
        ...(from || to
          ? {
              movement: {
                createdAt: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        movement: {
          include: {
            createdBy: true,
          },
        },
        product: {
          include: {
            unit: true,
          },
        },
        fromLocation: { include: { warehouse: true } },
        toLocation: { include: { warehouse: true } },
      },
      orderBy: {
        movement: { createdAt: 'desc' },
      },
    })

    // Transform to Excel format
    const rows = movements.map((line) => ({
      วันที่: new Date(line.movement.createdAt).toLocaleString('th-TH'),
      เลขที่เอกสาร: line.movement.docNumber,
      ประเภท: line.movement.type,
      สถานะ: line.movement.status,
      SKU: line.product.sku,
      ชื่อสินค้า: line.product.name,
      'จาก (คลัง)': line.fromLocation?.warehouse.name || '-',
      'จาก (โลเคชัน)': line.fromLocation?.code || '-',
      'ไป (คลัง)': line.toLocation?.warehouse.name || '-',
      'ไป (โลเคชัน)': line.toLocation?.code || '-',
      จำนวน: Number(line.qty),
      หน่วย: line.product.unit?.name || '-',
      ผู้บันทึก: line.movement.createdBy?.name || '-',
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    ws['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Movement Ledger')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="movement-ledger-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export movements error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
