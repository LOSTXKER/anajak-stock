'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Search, Package, Layers, Save, Loader2, CheckSquare, Square, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import { bulkUpdateVariantStockType, bulkUpdateProductStockType } from '@/actions/variants'
import { StockType } from '@/types'

interface ProductItem {
  id: string
  sku: string
  name: string
  stockType: StockType
  hasVariants: boolean
  category: string | null
}

interface VariantItem {
  id: string
  productId: string
  productName: string
  sku: string
  name: string | null
  stockType: StockType
  options: string
}

const stockTypeLabels: Record<StockType, { label: string; color: string }> = {
  STOCKED: { label: 'เก็บสต๊อค', color: 'bg-[var(--status-success-light)] text-[var(--status-success)]' },
  MADE_TO_ORDER: { label: 'สั่งผลิต (MTO)', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  DROP_SHIP: { label: 'Drop Ship', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
}

export default function BulkStockTypePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [variants, setVariants] = useState<VariantItem[]>([])
  
  // Selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set())
  
  // Filters
  const [search, setSearch] = useState('')
  const [filterStockType, setFilterStockType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'products' | 'variants'>('variants')
  
  // Target stock type for bulk update
  const [targetStockType, setTargetStockType] = useState<StockType>('STOCKED')

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/products/bulk-stock-type')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
        setVariants(data.variants || [])
      }
    } catch (error) {
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    }
    setIsLoading(false)
  }

  // Filtered items
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (filterStockType !== 'all' && p.stockType !== filterStockType) {
        return false
      }
      return true
    })
  }, [products, search, filterStockType])

  const filteredVariants = useMemo(() => {
    return variants.filter(v => {
      if (search) {
        const searchLower = search.toLowerCase()
        if (!v.productName.toLowerCase().includes(searchLower) && 
            !v.sku.toLowerCase().includes(searchLower) &&
            !(v.name?.toLowerCase().includes(searchLower)) &&
            !v.options.toLowerCase().includes(searchLower)) {
          return false
        }
      }
      if (filterStockType !== 'all' && v.stockType !== filterStockType) {
        return false
      }
      return true
    })
  }, [variants, search, filterStockType])

  // Selection helpers
  const toggleAllProducts = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)))
    }
  }

  const toggleAllVariants = () => {
    if (selectedVariants.size === filteredVariants.length) {
      setSelectedVariants(new Set())
    } else {
      setSelectedVariants(new Set(filteredVariants.map(v => v.id)))
    }
  }

  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleVariant = (id: string) => {
    setSelectedVariants(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Bulk update handler
  const handleBulkUpdate = async () => {
    const productCount = selectedProducts.size
    const variantCount = selectedVariants.size
    
    if (productCount === 0 && variantCount === 0) {
      toast.error('กรุณาเลือกรายการที่ต้องการอัปเดต')
      return
    }

    setIsSaving(true)
    try {
      let updatedCount = 0

      if (productCount > 0) {
        const result = await bulkUpdateProductStockType(
          Array.from(selectedProducts),
          targetStockType
        )
        if (result.success) {
          updatedCount += result.data?.updated || 0
        }
      }

      if (variantCount > 0) {
        const result = await bulkUpdateVariantStockType(
          Array.from(selectedVariants),
          targetStockType
        )
        if (result.success) {
          updatedCount += result.data?.updated || 0
        }
      }

      toast.success(`อัปเดตสำเร็จ ${updatedCount} รายการ`)
      setSelectedProducts(new Set())
      setSelectedVariants(new Set())
      await loadData()
      router.refresh()
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอัปเดต')
    }
    setIsSaving(false)
  }

  const totalSelected = selectedProducts.size + selectedVariants.size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="จัดการประเภทสต๊อค"
          description="เปลี่ยนประเภทการจัดเก็บสต๊อคหลายรายการพร้อมกัน"
          icon={<Package className="w-6 h-6" />}
        />
      </div>

      {/* Bulk Action Bar */}
      {totalSelected > 0 && (
        <Card className="bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[var(--accent-primary)]" />
                <span className="font-medium">
                  เลือกแล้ว {totalSelected} รายการ
                </span>
                {selectedProducts.size > 0 && (
                  <Badge variant="secondary">{selectedProducts.size} สินค้า</Badge>
                )}
                {selectedVariants.size > 0 && (
                  <Badge variant="secondary">{selectedVariants.size} ตัวเลือก</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">เปลี่ยนเป็น:</span>
                <Select value={targetStockType} onValueChange={(v) => setTargetStockType(v as StockType)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(stockTypeLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleBulkUpdate} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังอัปเดต...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      อัปเดต {totalSelected} รายการ
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                placeholder="ค้นหาสินค้า, SKU, ตัวเลือก..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStockType} onValueChange={setFilterStockType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="ประเภทสต๊อค" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {Object.entries(stockTypeLabels).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 border rounded-lg p-1">
              <Button
                variant={viewMode === 'variants' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('variants')}
              >
                <Layers className="w-4 h-4 mr-2" />
                ตัวเลือก ({variants.length})
              </Button>
              <Button
                variant={viewMode === 'products' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('products')}
              >
                <Package className="w-4 h-4 mr-2" />
                สินค้า ({products.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : viewMode === 'variants' ? (
            /* Variants Table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredVariants.length > 0 && selectedVariants.size === filteredVariants.length}
                        onCheckedChange={toggleAllVariants}
                      />
                    </TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>ตัวเลือก</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>ประเภทสต๊อค</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVariants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-[var(--text-muted)]">
                        ไม่พบตัวเลือกสินค้า
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVariants.map((variant) => (
                      <TableRow key={variant.id} className={selectedVariants.has(variant.id) ? 'bg-[var(--accent-primary)]/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedVariants.has(variant.id)}
                            onCheckedChange={() => toggleVariant(variant.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {variant.productName}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {variant.options.split(' / ').map((opt, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {opt}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-[var(--text-muted)]">
                          {variant.sku}
                        </TableCell>
                        <TableCell>
                          <Badge className={stockTypeLabels[variant.stockType].color}>
                            {stockTypeLabels[variant.stockType].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Products Table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                        onCheckedChange={toggleAllProducts}
                      />
                    </TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>ประเภทสต๊อค</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-[var(--text-muted)]">
                        ไม่พบสินค้า
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className={selectedProducts.has(product.id) ? 'bg-[var(--accent-primary)]/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-[var(--text-muted)]">
                          {product.sku}
                        </TableCell>
                        <TableCell className="text-[var(--text-muted)]">
                          {product.category || '-'}
                        </TableCell>
                        <TableCell>
                          {product.hasVariants ? (
                            <Badge variant="secondary">
                              <Layers className="w-3 h-3 mr-1" />
                              Variants
                            </Badge>
                          ) : (
                            <span className="text-[var(--text-muted)]">Simple</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={stockTypeLabels[product.stockType].color}>
                            {stockTypeLabels[product.stockType].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="text-sm text-[var(--text-muted)] space-y-1">
        <p>* <strong>เก็บสต๊อค</strong> - ระบบจะแจ้งเตือนเมื่อสต๊อคต่ำกว่า Reorder Point</p>
        <p>* <strong>สั่งผลิต (MTO)</strong> - สินค้าที่สั่งผลิตเมื่อมีออเดอร์ ไม่แจ้งเตือนสต๊อค</p>
        <p>* <strong>Drop Ship</strong> - สินค้าสั่งจากซัพพลายเออร์ส่งตรงลูกค้า ไม่แจ้งเตือนสต๊อค</p>
      </div>
    </div>
  )
}
