import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLot } from '@/actions/lots'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  MapPin, 
  ArrowDown, 
  ArrowUp, 
  ArrowLeftRight,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { DetailPageSkeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface PageProps {
  params: Promise<{ id: string }>
}

function getStatusInfo(expiryDate: Date | null, totalQtyOnHand: number) {
  if (totalQtyOnHand <= 0) {
    return {
      label: 'หมดสต๊อค',
      color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
      icon: <Package className="w-4 h-4" />,
    }
  }
  
  if (!expiryDate) {
    return {
      label: 'ปกติ',
      color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
      icon: <CheckCircle className="w-4 h-4" />,
    }
  }
  
  const now = new Date()
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntilExpiry < 0) {
    return {
      label: `หมดอายุแล้ว ${Math.abs(daysUntilExpiry)} วัน`,
      color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
      icon: <AlertTriangle className="w-4 h-4" />,
    }
  }
  
  if (daysUntilExpiry <= 30) {
    return {
      label: `ใกล้หมดอายุ (${daysUntilExpiry} วัน)`,
      color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
      icon: <Clock className="w-4 h-4" />,
    }
  }
  
  return {
    label: `ปกติ (${daysUntilExpiry} วัน)`,
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    icon: <CheckCircle className="w-4 h-4" />,
  }
}

function getMovementIcon(type: string) {
  switch (type) {
    case 'RECEIVE':
      return <ArrowDown className="w-4 h-4 text-[var(--status-success)]" />
    case 'ISSUE':
      return <ArrowUp className="w-4 h-4 text-[var(--status-error)]" />
    case 'TRANSFER':
      return <ArrowLeftRight className="w-4 h-4 text-[var(--status-info)]" />
    default:
      return <Package className="w-4 h-4" />
  }
}

async function LotDetailContent({ params }: PageProps) {
  const { id } = await params
  const result = await getLot(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const lot = result.data
  const statusInfo = getStatusInfo(
    lot.expiryDate ? new Date(lot.expiryDate) : null,
    lot.totalQtyOnHand
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/lots">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {lot.lotNumber}
            </h1>
            <Badge className={statusInfo.color}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.label}</span>
            </Badge>
          </div>
          <p className="text-[var(--text-secondary)] mt-1">
            {lot.product.name} ({lot.product.sku})
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">รับเข้า</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {lot.qtyReceived.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--status-success-light)] flex items-center justify-center">
                <ArrowDown className="w-6 h-6 text-[var(--status-success)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">คงเหลือ</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {lot.totalQtyOnHand.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-light)] flex items-center justify-center">
                <Package className="w-6 h-6 text-[var(--accent-primary)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">วันหมดอายุ</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {lot.expiryDate 
                    ? format(new Date(lot.expiryDate), 'd MMM yyyy', { locale: th })
                    : '-'
                  }
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--status-warning-light)] flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[var(--status-warning)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">จำนวน Location</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {lot.balances.filter(b => Number(b.qtyOnHand) > 0).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--status-info-light)] flex items-center justify-center">
                <MapPin className="w-6 h-6 text-[var(--status-info)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lot Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ข้อมูล Lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">หมายเลข Lot</p>
                <p className="font-mono font-semibold text-[var(--text-primary)]">{lot.lotNumber}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">สินค้า</p>
                <Link 
                  href={`/products/${lot.product.id}`}
                  className="font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  {lot.product.name}
                </Link>
              </div>
              {lot.variant && (
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Variant</p>
                  <p className="text-[var(--text-primary)]">{lot.variant.name || lot.variant.sku}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-[var(--text-muted)]">หมวดหมู่</p>
                <p className="text-[var(--text-primary)]">{lot.product.category?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">วันที่ผลิต</p>
                <p className="text-[var(--text-primary)]">
                  {lot.manufacturedDate 
                    ? format(new Date(lot.manufacturedDate), 'd MMM yyyy', { locale: th })
                    : '-'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">วันที่รับเข้า</p>
                <p className="text-[var(--text-primary)]">
                  {format(new Date(lot.receivedDate), 'd MMM yyyy', { locale: th })}
                </p>
              </div>
            </div>
            {lot.note && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">หมายเหตุ</p>
                <p className="text-[var(--text-primary)]">{lot.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              สต๊อคตาม Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lot.balances.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center py-8">ไม่มีสต๊อคใน Location ใด</p>
            ) : (
              <div className="space-y-2">
                {lot.balances.map((balance, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {balance.location.warehouse?.name}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {balance.location.code}
                      </p>
                    </div>
                    <span className={`font-mono font-bold text-lg ${
                      Number(balance.qtyOnHand) > 0 
                        ? 'text-[var(--text-primary)]' 
                        : 'text-[var(--text-muted)]'
                    }`}>
                      {Number(balance.qtyOnHand).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ประวัติการเคลื่อนไหว</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lot.movementLines.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center py-8">ยังไม่มีประวัติการเคลื่อนไหว</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>เอกสาร</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lot.movementLines.map((ml, i) => {
                  const movement = ml.movementLine.movement
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-[var(--text-secondary)]">
                        {format(new Date(ml.createdAt), 'd MMM yyyy HH:mm', { locale: th })}
                      </TableCell>
                      <TableCell>
                        <Link 
                          href={`/movements/${movement.id}`}
                          className="font-mono text-[var(--accent-primary)] hover:underline"
                        >
                          {movement.docNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getMovementIcon(movement.type)}
                          <span className="text-[var(--text-secondary)]">
                            {movement.type === 'RECEIVE' && 'รับเข้า'}
                            {movement.type === 'ISSUE' && 'เบิกออก'}
                            {movement.type === 'TRANSFER' && 'โอนย้าย'}
                            {movement.type === 'ADJUST' && 'ปรับยอด'}
                            {movement.type === 'RETURN' && 'คืนของ'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-semibold ${
                          movement.type === 'RECEIVE' || movement.type === 'RETURN'
                            ? 'text-[var(--status-success)]'
                            : movement.type === 'ISSUE'
                              ? 'text-[var(--status-error)]'
                              : 'text-[var(--text-primary)]'
                        }`}>
                          {movement.type === 'RECEIVE' || movement.type === 'RETURN' ? '+' : '-'}
                          {Number(ml.qty).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {ml.movementLine.toLocation?.code || ml.movementLine.fromLocation?.code || '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LotDetailPage(props: PageProps) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <LotDetailContent {...props} />
    </Suspense>
  )
}
