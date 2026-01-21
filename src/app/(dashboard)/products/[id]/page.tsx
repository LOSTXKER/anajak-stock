import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/date'
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
import { ArrowLeft, Edit, Package, Warehouse, History, Layers } from 'lucide-react'
import { VariantsSection } from './variants-section'
import { ProductStats } from './product-stats'
import { PageHeader, EmptyState } from '@/components/common'
import { PrintLabelButton } from './print-label-button'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      unit: true,
      stockBalances: {
        where: { variantId: null },
        include: {
          location: {
            include: {
              warehouse: true,
            },
          },
        },
        orderBy: {
          location: {
            warehouse: { name: 'asc' },
          },
        },
      },
      variants: {
        where: { active: true, deletedAt: null },
        include: {
          optionValues: {
            include: {
              optionValue: {
                include: {
                  optionType: true,
                },
              },
            },
          },
          stockBalances: {
            include: {
              location: {
                include: {
                  warehouse: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return product
}

async function getRecentMovements(productId: string) {
  const movements = await prisma.movementLine.findMany({
    where: { productId },
    include: {
      movement: {
        include: {
          createdBy: true,
        },
      },
      variant: {
        include: {
          optionValues: {
            include: {
              optionValue: true,
            },
          },
        },
      },
      fromLocation: { include: { warehouse: true } },
      toLocation: { include: { warehouse: true } },
    },
    orderBy: {
      movement: { createdAt: 'desc' },
    },
    take: 10,
  })

  return movements
}

const typeColors: Record<string, string> = {
  RECEIVE: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
  ISSUE: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
  TRANSFER: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
  ADJUST: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
  RETURN: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
}

async function ProductDetail({ id }: { id: string }) {
  const [product, recentMovements] = await Promise.all([
    getProduct(id),
    getRecentMovements(id),
  ])

  if (!product) {
    notFound()
  }

  // Calculate total stock (including variants)
  let totalStock = 0
  if (product.hasVariants) {
    totalStock = product.variants.reduce((sum, variant) => {
      return sum + variant.stockBalances.reduce((vSum, sb) => vSum + Number(sb.qtyOnHand), 0)
    }, 0)
  } else {
    totalStock = product.stockBalances.reduce(
      (sum, sb) => sum + Number(sb.qtyOnHand),
      0
    )
  }

  const totalValue = totalStock * Number(product.standardCost)
  const isBelowReorderPoint = totalStock <= Number(product.reorderPoint) && Number(product.reorderPoint) > 0

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 md:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" asChild>
            <Link href="/products">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-2xl font-bold break-words">{product.name}</h1>
              <Badge
                className={
                  product.active
                    ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                }
              >
                {product.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
              </Badge>
              {product.hasVariants && (
                <Badge className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
                  <Layers className="w-3 h-3 mr-1" />
                  {product.variants.length} Variants
                </Badge>
              )}
            </div>
            <p className="text-[var(--text-muted)] mt-1 font-mono text-xs md:text-sm">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrintLabelButton
            product={{
              sku: product.sku,
              name: product.name,
              barcode: product.barcode,
              price: Number(product.standardCost),
              unit: product.unit?.name,
            }}
          />
          <Button size="sm" className="w-full sm:w-auto" asChild>
            <Link href={`/products/${product.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              แก้ไข
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <ProductStats
        totalStock={totalStock}
        totalValue={totalValue}
        unit={product.unit?.name || 'ชิ้น'}
        standardCost={Number(product.standardCost)}
        reorderPoint={Number(product.reorderPoint)}
        isBelowReorderPoint={isBelowReorderPoint}
        hasVariants={product.hasVariants}
        variantCount={product.variants.length}
        locationCount={product.stockBalances.length}
      />

      {/* Variants Section */}
      {product.hasVariants && (
        <VariantsSection 
          productId={product.id}
          productSku={product.sku}
          productName={product.name}
          variants={product.variants.map(v => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            barcode: v.barcode,
            stockType: v.stockType,
            costPrice: Number(v.costPrice),
            sellingPrice: Number(v.sellingPrice),
            reorderPoint: Number(v.reorderPoint),
            lowStockAlert: v.lowStockAlert,
            options: v.optionValues.map(ov => ({
              typeName: ov.optionValue.optionType.name,
              value: ov.optionValue.value,
            })),
            totalStock: v.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0),
            stockByLocation: v.stockBalances.map(sb => ({
              locationId: sb.locationId,
              locationCode: sb.location.code,
              warehouseName: sb.location.warehouse.name,
              qty: Number(sb.qtyOnHand),
            })),
          }))}
        />
      )}

      {/* Product Details & Stock by Location */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลสินค้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-[var(--text-muted)]">หมวดหมู่</p>
              <p className="font-medium">{product.category?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">หน่วยนับ</p>
              <p className="font-medium">{product.unit?.name || '-'}</p>
            </div>
            {!product.hasVariants && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">Barcode</p>
                <p className="font-mono text-sm">{product.barcode || '-'}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-[var(--text-muted)]">รายละเอียด</p>
              <p className="font-medium">{product.description || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border-default)]">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Min Qty</p>
                <p className="font-medium">{Number(product.minQty).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Max Qty</p>
                <p className="font-medium">{Number(product.maxQty).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock by Location (only for non-variant products) */}
        {!product.hasVariants && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-[var(--accent-primary)]" />
                สต๊อคตาม Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {product.stockBalances.length === 0 ? (
                <EmptyState
                  icon={<Warehouse className="w-8 h-8" />}
                  title="ไม่มีสต๊อค"
                  description="ยังไม่มีสินค้าในคลัง"
                />
              ) : (
                <div className="overflow-x-auto mobile-scroll">
                  <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>คลัง</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead className="text-right">มูลค่า</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.stockBalances.map((sb) => (
                      <TableRow key={sb.id}>
                        <TableCell className="font-medium">
                          {sb.location.warehouse.name}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-[var(--text-muted)]">
                          {sb.location.code}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {Number(sb.qtyOnHand).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[var(--text-muted)]">
                          ฿{(Number(sb.qtyOnHand) * Number(product.standardCost)).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {product.hasVariants && <div className="lg:col-span-2"></div>}
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--accent-primary)]" />
            การเคลื่อนไหวล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? (
            <EmptyState
              icon={<History className="w-8 h-8" />}
              title="ไม่มีประวัติ"
              description="ยังไม่มีประวัติการเคลื่อนไหว"
            />
          ) : (
            <div className="overflow-x-auto mobile-scroll">
              <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>เลขที่เอกสาร</TableHead>
                  {product.hasVariants && <TableHead>Variant</TableHead>}
                  <TableHead>ประเภท</TableHead>
                  <TableHead>จาก</TableHead>
                  <TableHead>ไป</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead>โดย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm text-[var(--text-muted)]">
                      {formatDate(line.movement.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/movements/${line.movement.id}`}
                        className="text-[var(--accent-primary)] hover:underline font-mono text-sm"
                      >
                        {line.movement.docNumber}
                      </Link>
                    </TableCell>
                    {product.hasVariants && (
                      <TableCell>
                        {line.variant ? (
                          <div className="flex flex-wrap gap-1">
                            {line.variant.optionValues.map((ov, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {ov.optionValue.value}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={typeColors[line.movement.type]}>
                        {line.movement.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">
                      {line.fromLocation
                        ? `${line.fromLocation.warehouse.name} / ${line.fromLocation.code}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">
                      {line.toLocation
                        ? `${line.toLocation.warehouse.name} / ${line.toLocation.code}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {Number(line.qty).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">
                      {line.movement.createdBy?.name || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <ProductDetail id={id} />
    </Suspense>
  )
}
