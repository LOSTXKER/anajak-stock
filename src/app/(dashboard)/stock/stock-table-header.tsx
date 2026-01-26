'use client'

import { TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import type { StockSortField, SortOrder } from '@/actions/stock'

interface StockTableHeaderProps {
  sortBy: StockSortField
  sortOrder: SortOrder
}

export function StockTableHeader({ sortBy, sortOrder }: StockTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <SortableTableHead
          column="sku"
          label="SKU"
          currentSort={sortBy}
          currentOrder={sortOrder}
        />
        <SortableTableHead
          column="name"
          label="สินค้า"
          currentSort={sortBy}
          currentOrder={sortOrder}
        />
        <TableHead>ตัวเลือก</TableHead>
        <SortableTableHead
          column="category"
          label="หมวดหมู่"
          currentSort={sortBy}
          currentOrder={sortOrder}
        />
        <SortableTableHead
          column="warehouse"
          label="คลัง"
          currentSort={sortBy}
          currentOrder={sortOrder}
        />
        <SortableTableHead
          column="location"
          label="โลเคชัน"
          currentSort={sortBy}
          currentOrder={sortOrder}
        />
        <SortableTableHead
          column="qty"
          label="คงเหลือ"
          currentSort={sortBy}
          currentOrder={sortOrder}
          className="text-right"
        />
        <SortableTableHead
          column="rop"
          label="ROP"
          currentSort={sortBy}
          currentOrder={sortOrder}
          className="text-right"
        />
        <TableHead className="text-center">สถานะ</TableHead>
      </TableRow>
    </TableHeader>
  )
}
