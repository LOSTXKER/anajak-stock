import { Suspense } from 'react'
import Link from 'next/link'
import { getStockTakes } from '@/actions/stock-take'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ClipboardCheck, Plus, Eye, Warehouse, Clock, CheckCircle2, XCircle, Play } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common'
import { TableSkeleton } from '@/components/ui/skeleton'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  DRAFT: { 
    color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
    icon: <ClipboardCheck className="w-3.5 h-3.5" />,
    label: 'แบบร่าง'
  },
  IN_PROGRESS: { 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
    icon: <Play className="w-3.5 h-3.5" />,
    label: 'กำลังนับ'
  },
  COMPLETED: { 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'รอนุมัติ'
  },
  APPROVED: { 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'อนุมัติแล้ว'
  },
  CANCELLED: { 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'ยกเลิก'
  },
}

async function StockTakeList() {
  const result = await getStockTakes()

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-[var(--status-error)]">
          {result.error}
        </CardContent>
      </Card>
    )
  }

  const stockTakes = result.data

  if (stockTakes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={<ClipboardCheck className="w-8 h-8" />}
            title="ยังไม่มีใบตรวจนับสต๊อค"
            description="สร้างใบตรวจนับเพื่อเริ่มตรวจสอบสต๊อค"
            action={
              <Button asChild className="mt-4">
                <Link href="/stock-take/new">
                  <Plus className="w-4 h-4 mr-2" />
                  สร้างใบตรวจนับ
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[var(--accent-primary)]" />
          รายการตรวจนับ
          <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
            {stockTakes.length} รายการ
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัส</TableHead>
              <TableHead>คลังสินค้า</TableHead>
              <TableHead className="text-right">จำนวนรายการ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>ผู้นับ</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockTakes.map((st) => {
              const status = statusConfig[st.status] || statusConfig.DRAFT

              return (
                <TableRow key={st.id}>
                  <TableCell className="font-mono font-medium">{st.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-[var(--text-muted)]" />
                      {st.warehouse.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {st._count.lines.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={status.color}>
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[var(--text-muted)]">
                    {st.countedBy?.name || '-'}
                  </TableCell>
                  <TableCell className="text-[var(--text-muted)]">
                    {new Date(st.createdAt).toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/stock-take/${st.id}`}>
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function StockTakePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="ตรวจนับสต๊อค"
          description="ตรวจนับสินค้าและปรับยอดสต๊อคอัตโนมัติ"
          icon={<ClipboardCheck className="w-6 h-6" />}
        />
        <Button asChild>
          <Link href="/stock-take/new">
            <Plus className="w-4 h-4 mr-2" />
            สร้างใบตรวจนับ
          </Link>
        </Button>
      </div>

      {/* List */}
      <Suspense
        fallback={<Card><CardContent className="p-0"><TableSkeleton rows={6} cols={7} /></CardContent></Card>}
      >
        <StockTakeList />
      </Suspense>
    </div>
  )
}
