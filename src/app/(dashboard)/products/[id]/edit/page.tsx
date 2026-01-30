'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Save, Loader2, Package, Settings } from 'lucide-react'
import { getProductById, updateProduct, getCategories, getUnits } from '@/actions/products'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import { StockType } from '@/types'

const stockTypeLabels: Record<StockType, { label: string; description: string }> = {
  STOCKED: { label: 'เก็บสต๊อคเอง', description: 'แจ้งเตือนเมื่อสต๊อคต่ำกว่า Reorder Point' },
  MADE_TO_ORDER: { label: 'สั่งผลิตเมื่อมีออเดอร์', description: 'ไม่แจ้งเตือนสต๊อค' },
  DROP_SHIP: { label: 'สั่งจากซัพพลายเออร์ส่งตรง', description: 'ไม่แจ้งเตือนสต๊อค' },
}

interface EditProductFormData {
  sku: string
  name: string
  supplierName?: string
  description?: string
  barcode?: string
  categoryId?: string
  unitId?: string
  stockType: StockType
  reorderPoint: number
  minQty: number
  maxQty: number
  standardCost: number
  active: boolean
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; code: string; name: string }[]>([])
  const [productId, setProductId] = useState<string>('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditProductFormData>()

  useEffect(() => {
    async function loadData() {
      const { id } = await params
      setProductId(id)

      const [productResult, cats, unitList] = await Promise.all([
        getProductById(id),
        getCategories(),
        getUnits(),
      ])

      if (!productResult.success || !productResult.data) {
        toast.error('ไม่พบสินค้า')
        router.push('/products')
        return
      }

      const product = productResult.data
      setCategories(cats)
      setUnits(unitList)

      // Set form values
      setValue('sku', product.sku)
      setValue('name', product.name)
      setValue('supplierName', product.supplierName || '')
      setValue('description', product.description || '')
      setValue('barcode', product.barcode || '')
      setValue('categoryId', product.categoryId || '')
      setValue('unitId', product.unitId || '')
      setValue('stockType', product.stockType || 'STOCKED')
      setValue('reorderPoint', Number(product.reorderPoint))
      setValue('minQty', Number(product.minQty))
      setValue('maxQty', Number(product.maxQty))
      setValue('standardCost', Number(product.standardCost))
      setValue('active', product.active)

      setIsLoading(false)
    }

    loadData()
  }, [params, router, setValue])

  async function onSubmit(data: EditProductFormData) {
    setIsSaving(true)
    const result = await updateProduct(productId, {
      ...data,
      categoryId: data.categoryId || undefined,
      unitId: data.unitId || undefined,
      stockType: data.stockType,
    })
    setIsSaving(false)

    if (result.success) {
      toast.success('บันทึกการแก้ไขเรียบร้อย')
      router.push(`/products/${productId}`)
    } else {
      toast.error(result.error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/products/${productId}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="แก้ไขสินค้า"
          description={`SKU: ${watch('sku')}`}
          icon={<Package className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--accent-primary)]" />
                ข้อมูลพื้นฐาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sku">
                  SKU <span className="text-[var(--status-error)]">*</span>
                </Label>
                <Input
                  id="sku"
                  {...register('sku', { required: 'กรุณากรอก SKU' })}
                />
                {errors.sku && (
                  <p className="text-sm text-[var(--status-error)]">{errors.sku.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  ชื่อสินค้า <span className="text-[var(--status-error)]">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name', { required: 'กรุณากรอกชื่อสินค้า' })}
                />
                {errors.name && (
                  <p className="text-sm text-[var(--status-error)]">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierName">ชื่อ Supplier</Label>
                <Input
                  id="supplierName"
                  {...register('supplierName')}
                  placeholder="ชื่อที่ Supplier เรียก (ไม่บังคับ)"
                />
                <p className="text-xs text-[var(--text-muted)]">
                  ใช้ในการคัดลอกข้อความส่ง Supplier
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  {...register('barcode')}
                  className="font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>หมวดหมู่</Label>
                  <Select
                    value={watch('categoryId') || '__none__'}
                    onValueChange={(v) => setValue('categoryId', v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกหมวดหมู่" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>หน่วยนับ</Label>
                  <Select
                    value={watch('unitId') || '__none__'}
                    onValueChange={(v) => setValue('unitId', v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกหน่วย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-[var(--accent-primary)]" />
                การตั้งค่าสต๊อค
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>ประเภทการจัดเก็บ</Label>
                <Select
                  value={watch('stockType') || 'STOCKED'}
                  onValueChange={(v) => setValue('stockType', v as StockType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(stockTypeLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[var(--text-muted)]">
                  {stockTypeLabels[watch('stockType') || 'STOCKED']?.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  step="0.01"
                  {...register('reorderPoint', { valueAsNumber: true })}
                  disabled={watch('stockType') !== 'STOCKED'}
                />
                <p className="text-xs text-[var(--text-muted)]">
                  {watch('stockType') === 'STOCKED' 
                    ? 'ระบบจะแจ้งเตือนเมื่อสต๊อคต่ำกว่าจุดนี้'
                    : 'ไม่ใช้สำหรับสินค้าประเภทนี้'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minQty">Min Qty</Label>
                  <Input
                    id="minQty"
                    type="number"
                    step="0.01"
                    {...register('minQty', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxQty">Max Qty</Label>
                  <Input
                    id="maxQty"
                    type="number"
                    step="0.01"
                    {...register('maxQty', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="standardCost">ต้นทุนมาตรฐาน (บาท)</Label>
                <div className="flex items-center">
                  <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-3 py-2 text-sm">฿</span>
                  <Input
                    id="standardCost"
                    type="number"
                    step="0.01"
                    {...register('standardCost', { valueAsNumber: true })}
                    className="rounded-l-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-default)]">
                <Checkbox
                  id="active"
                  checked={watch('active')}
                  onCheckedChange={(checked) => setValue('active', checked as boolean)}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  เปิดใช้งานสินค้านี้
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href={`/products/${productId}`}>ยกเลิก</Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                บันทึก
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
