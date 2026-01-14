import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Truck, Plus, Phone, Mail, Clock, Eye } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common'

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { pos: true },
      },
    },
  })
}

async function SuppliersContent() {
  const suppliers = await getSuppliers()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="ซัพพลายเออร์"
          description={`จัดการข้อมูลผู้ขาย ${suppliers.length} ราย`}
          icon={<Truck className="w-6 h-6" />}
        />
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่ม Supplier
          </Link>
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ผู้ติดต่อ</TableHead>
                <TableHead>โทรศัพท์</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Lead Time</TableHead>
                <TableHead className="text-center">PO</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <EmptyState
                      icon={<Truck className="w-8 h-8" />}
                      title="ยังไม่มี Supplier"
                      description="เพิ่ม Supplier เพื่อเริ่มสั่งซื้อสินค้า"
                      action={
                        <Button className="mt-4" asChild>
                          <Link href="/suppliers/new">
                            <Plus className="w-4 h-4 mr-2" />
                            เพิ่ม Supplier
                          </Link>
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                      {supplier.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {supplier.name}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {supplier.contactName || '-'}
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          {supplier.phone}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.email ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          {supplier.email}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {supplier.leadTimeDays ? (
                        <div className="flex items-center justify-center gap-1 text-sm">
                          <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          {supplier.leadTimeDays} วัน
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        {supplier._count.pos}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          supplier.active
                            ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        }
                      >
                        {supplier.active ? 'ใช้งาน' : 'ปิด'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/suppliers/${supplier.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><TableSkeleton rows={8} cols={8} /></div>}>
      <SuppliersContent />
    </Suspense>
  )
}
