'use server'

import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export async function exportStockBalancesToCSV() {
  const stockBalances = await prisma.stockBalance.findMany({
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
      { product: { name: 'asc' } },
      { location: { code: 'asc' } },
    ],
  })

  const headers = ['SKU', 'ชื่อสินค้า', 'หมวดหมู่', 'หน่วย', 'คลัง', 'โลเคชัน', 'คงเหลือ', 'ต้นทุน', 'มูลค่า']
  const rows = stockBalances.map((sb) => [
    sb.product.sku,
    sb.product.name,
    sb.product.category?.name || '',
    sb.product.unit?.name || '',
    sb.location.warehouse.name,
    sb.location.code,
    Number(sb.qtyOnHand),
    Number(sb.product.standardCost),
    Number(sb.qtyOnHand) * Number(sb.product.standardCost),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  return csvContent
}

export async function exportMovementsToCSV(params?: { startDate?: Date; endDate?: Date }) {
  const movements = await prisma.stockMovement.findMany({
    where: {
      status: 'POSTED',
      ...(params?.startDate && params?.endDate && {
        postedAt: {
          gte: params.startDate,
          lte: params.endDate,
        },
      }),
    },
    include: {
      createdBy: true,
      approvedBy: true,
      lines: {
        include: {
          product: true,
          fromLocation: { include: { warehouse: true } },
          toLocation: { include: { warehouse: true } },
        },
      },
    },
    orderBy: { postedAt: 'desc' },
  })

  const headers = [
    'เลขที่เอกสาร',
    'ประเภท',
    'วันที่',
    'SKU',
    'สินค้า',
    'จากคลัง',
    'จากโลเคชัน',
    'ไปคลัง',
    'ไปโลเคชัน',
    'จำนวน',
    'ต้นทุน',
    'ผู้สร้าง',
    'ผู้อนุมัติ',
  ]

  const rows: (string | number)[][] = []

  movements.forEach((mov) => {
    mov.lines.forEach((line) => {
      rows.push([
        mov.docNumber,
        mov.type,
        mov.postedAt ? format(mov.postedAt, 'd MMM yyyy HH:mm', { locale: th }) : '',
        line.product.sku,
        line.product.name,
        line.fromLocation?.warehouse.name || '',
        line.fromLocation?.code || '',
        line.toLocation?.warehouse.name || '',
        line.toLocation?.code || '',
        Number(line.qty),
        Number(line.unitCost),
        mov.createdBy.name,
        mov.approvedBy?.name || '',
      ])
    })
  })

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  return csvContent
}

export async function exportProductsToCSV() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: {
      category: true,
      unit: true,
    },
    orderBy: { name: 'asc' },
  })

  const headers = [
    'SKU',
    'ชื่อสินค้า',
    'รายละเอียด',
    'Barcode',
    'หมวดหมู่',
    'หน่วย',
    'Reorder Point',
    'Min Qty',
    'Max Qty',
    'ต้นทุนมาตรฐาน',
    'ต้นทุนล่าสุด',
    'สถานะ',
  ]

  const rows = products.map((p) => [
    p.sku,
    p.name,
    p.description || '',
    p.barcode || '',
    p.category?.name || '',
    p.unit?.name || '',
    Number(p.reorderPoint),
    Number(p.minQty),
    Number(p.maxQty),
    Number(p.standardCost),
    Number(p.lastCost),
    p.active ? 'ใช้งาน' : 'ปิดใช้งาน',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  return csvContent
}
