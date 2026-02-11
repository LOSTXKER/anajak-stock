'use client'

import { useState, useEffect, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
import { Package, ArrowLeft, Loader2, Plus, X, RefreshCw, ImagePlus, MapPin } from 'lucide-react'
import { createProduct, getCategories, getUnits } from '@/actions/products'
import { createProductWithInlineVariants } from '@/actions/variants'
import { getLocations, type LocationData } from '@/actions/warehouses'
import { toast } from 'sonner'
import type { Category, UnitOfMeasure } from '@/generated/prisma'
import { PageHeader } from '@/components/common'

// Inline option group (like Shopee)
interface InlineOptionGroup {
  id: string
  name: string
  values: { id: string; value: string; imageUrl?: string }[]
}

interface VariantRow {
  id: string
  sku: string
  costPrice: number
  sellingPrice: number
  stock: number
  options: { groupName: string; value: string }[]
}

export default function NewProductPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<UnitOfMeasure[]>([])
  const [locations, setLocations] = useState<LocationData[]>([])

  // Form state
  const [hasVariants, setHasVariants] = useState(false)
  const [optionGroups, setOptionGroups] = useState<InlineOptionGroup[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [baseSku, setBaseSku] = useState('')

  // Initial stock state
  const [hasInitialStock, setHasInitialStock] = useState(false)
  const [initialLocationId, setInitialLocationId] = useState('')
  const [initialQty, setInitialQty] = useState<number>(0)
  const [initialNote, setInitialNote] = useState('')

  // Bulk update state
  const [bulkPrice, setBulkPrice] = useState<string>('')
  const [bulkStock, setBulkStock] = useState<string>('')

  useEffect(() => {
    async function loadData() {
      const [cats, uoms, locs] = await Promise.all([
        getCategories(),
        getUnits(),
        getLocations(),
      ])
      setCategories(cats)
      setUnits(uoms)
      setLocations(locs)
      // Set default location if available
      if (locs.length > 0) {
        setInitialLocationId(locs[0].id)
      }
    }
    loadData()
  }, [])

  // Auto-generate variants when option values change
  useEffect(() => {
    if (!hasVariants) return
    
    const groupsWithValues = optionGroups.filter(g => g.values.length > 0)
    if (groupsWithValues.length === 0) {
      setVariants([])
      return
    }

    // Cartesian product
    const cartesian = <T,>(...arrays: T[][]): T[][] => {
      return arrays.reduce<T[][]>(
        (acc, curr) => acc.flatMap(combo => curr.map(item => [...combo, item])),
        [[]]
      )
    }

    const valueArrays = groupsWithValues.map(g => g.values.map(v => ({ groupName: g.name, value: v.value })))
    const combinations = cartesian(...valueArrays)

    const newVariants: VariantRow[] = combinations.map((combo, index) => {
      const existingVariant = variants.find(v => 
        v.options.length === combo.length &&
        v.options.every((opt, i) => opt.value === combo[i].value && opt.groupName === combo[i].groupName)
      )

      const skuSuffix = combo.map(c => 
        c.value.replace(/\s+/g, '').substring(0, 3).toUpperCase()
      ).join('-')

      return existingVariant || {
        id: `temp-${index}-${Date.now()}`,
        sku: baseSku ? `${baseSku}-${skuSuffix}` : skuSuffix,
        costPrice: 0,
        sellingPrice: 0,
        stock: 0,
        options: combo,
      }
    })

    setVariants(newVariants)
  }, [optionGroups, hasVariants, baseSku])

  const addOptionGroup = () => {
    if (optionGroups.length >= 2) {
      toast.error('สามารถเพิ่มได้สูงสุด 2 กลุ่มตัวเลือก')
      return
    }
    const newGroup: InlineOptionGroup = {
      id: `group-${Date.now()}`,
      name: '',
      values: [],
    }
    setOptionGroups([...optionGroups, newGroup])
  }

  const updateGroupName = (groupId: string, name: string) => {
    setOptionGroups(optionGroups.map(g => 
      g.id === groupId ? { ...g, name } : g
    ))
  }

  const removeOptionGroup = (groupId: string) => {
    setOptionGroups(optionGroups.filter(g => g.id !== groupId))
  }

  const addValueToGroup = (groupId: string, value: string = '') => {
    setOptionGroups(optionGroups.map(g => {
      if (g.id !== groupId) return g
      return { 
        ...g, 
        values: [...g.values, { id: `val-${Date.now()}`, value }] 
      }
    }))
  }

  const updateOptionValue = (groupId: string, valueId: string, newValue: string) => {
    setOptionGroups(optionGroups.map(g => {
      if (g.id !== groupId) return g
      return {
        ...g,
        values: g.values.map(v => v.id === valueId ? { ...v, value: newValue } : v)
      }
    }))
  }

  const removeValueFromGroup = (groupId: string, valueId: string) => {
    setOptionGroups(optionGroups.map(g => {
      if (g.id !== groupId) return g
      return { ...g, values: g.values.filter(v => v.id !== valueId) }
    }))
  }

  const updateVariant = (variantId: string, field: keyof VariantRow, value: string | number) => {
    setVariants(variants.map(v => 
      v.id === variantId ? { ...v, [field]: value } : v
    ))
  }

  const applyBulkPrice = () => {
    if (!bulkPrice) return
    const price = Number(bulkPrice)
    setVariants(variants.map(v => ({ ...v, sellingPrice: price })))
    toast.success('อัปเดตราคาทั้งหมดแล้ว')
  }

  const applyBulkStock = () => {
    if (!bulkStock) return
    const stock = Number(bulkStock)
    setVariants(variants.map(v => ({ ...v, stock })))
    toast.success('อัปเดตคลังทั้งหมดแล้ว')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      if (hasVariants) {
        if (variants.length === 0) {
          toast.error('กรุณาเพิ่มตัวเลือกสินค้าก่อน')
          setIsLoading(false)
          return
        }

        if (optionGroups.some(g => !g.name.trim())) {
          toast.error('กรุณากรอกชื่อกลุ่มตัวเลือกให้ครบ')
          setIsLoading(false)
          return
        }

        if (optionGroups.some(g => g.values.some(v => !v.value.trim()))) {
          toast.error('กรุณากรอกค่าตัวเลือกให้ครบ')
          setIsLoading(false)
          return
        }

        const skus = variants.map(v => v.sku)
        const uniqueSkus = new Set(skus)
        if (uniqueSkus.size !== skus.length) {
          toast.error('มี SKU ซ้ำกัน')
          setIsLoading(false)
          return
        }

        // Prepare initial stock data for variants
        const initialStock = hasInitialStock && initialLocationId ? {
          locationId: initialLocationId,
          note: initialNote || 'สต๊อคเริ่มต้น',
          items: variants.filter(v => v.stock > 0).map(v => ({
            sku: v.sku,
            qty: v.stock,
          })),
        } : undefined

        const result = await createProductWithInlineVariants({
          sku: formData.get('sku') as string,
          name: formData.get('name') as string,
          description: (formData.get('description') as string) || undefined,
          categoryId: (formData.get('categoryId') as string) || undefined,
          unitId: (formData.get('unitId') as string) || undefined,
          itemType: (formData.get('itemType') as 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'CONSUMABLE') || 'FINISHED_GOOD',
          reorderPoint: 0,
          minQty: 0,
          maxQty: 0,
          standardCost: 0,
          optionGroups: optionGroups.map(g => ({
            name: g.name,
            values: g.values.map(v => v.value),
          })),
          variants: variants.map(v => ({
            sku: v.sku,
            stockType: 'STOCKED' as const, // Default to stocked
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            reorderPoint: 0,
            minQty: 0,
            maxQty: 0,
            lowStockAlert: true,
            options: v.options,
          })),
          initialStock,
        })

        if (result.success) {
          toast.success('สร้างสินค้าเรียบร้อยแล้ว')
          router.push(`/products/${result.data.id}`)
        } else {
          toast.error(result.error)
        }
      } else {
        // Prepare initial stock for simple product
        const initialStock = hasInitialStock && initialLocationId && initialQty > 0 ? {
          locationId: initialLocationId,
          qty: initialQty,
          note: initialNote || 'สต๊อคเริ่มต้น',
        } : undefined

        const result = await createProduct({
          sku: formData.get('sku') as string,
          name: formData.get('name') as string,
          supplierName: (formData.get('supplierName') as string) || undefined,
          description: (formData.get('description') as string) || undefined,
          barcode: (formData.get('barcode') as string) || undefined,
          categoryId: (formData.get('categoryId') as string) || undefined,
          unitId: (formData.get('unitId') as string) || undefined,
          stockType: 'STOCKED',
          itemType: (formData.get('itemType') as 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'CONSUMABLE') || 'FINISHED_GOOD',
          reorderPoint: Number(formData.get('reorderPoint')) || 0,
          minQty: Number(formData.get('minQty')) || 0,
          maxQty: Number(formData.get('maxQty')) || 0,
          standardCost: Number(formData.get('standardCost')) || 0,
          initialStock,
        })

        if (result.success) {
          toast.success('สร้างสินค้าเรียบร้อยแล้ว')
          router.push('/products')
        } else {
          toast.error(result.error)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href="/products">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="เพิ่มสินค้าใหม่"
          description="กรอกข้อมูลสินค้าที่ต้องการเพิ่ม"
          icon={<Package className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลพื้นฐาน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>
                  SKU หลัก <span className="text-[var(--status-error)]">*</span>
                </Label>
                <Input
                  name="sku"
                  required
                  placeholder="เช่น SHIRT-001"
                  value={baseSku}
                  onChange={(e) => setBaseSku(e.target.value)}
                />
              </div>
              {!hasVariants && (
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input
                    name="barcode"
                    placeholder="เช่น 8851234567890"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                ชื่อสินค้า <span className="text-[var(--status-error)]">*</span>
              </Label>
              <Input
                name="name"
                required
                placeholder="เช่น เสื้อยืดคอกลม"
              />
            </div>

            <div className="space-y-2">
              <Label>ชื่อ Supplier</Label>
              <Input
                name="supplierName"
                placeholder="ชื่อที่ Supplier เรียก (ไม่บังคับ)"
              />
              <p className="text-xs text-[var(--text-muted)]">
                ใช้ในการคัดลอกข้อความส่ง Supplier
              </p>
            </div>

            <div className="space-y-2">
              <Label>รายละเอียด</Label>
              <Textarea
                name="description"
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>ประเภทสินค้า</Label>
              <Select name="itemType" defaultValue="FINISHED_GOOD">
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FINISHED_GOOD">สินค้าสำเร็จรูป</SelectItem>
                  <SelectItem value="RAW_MATERIAL">วัตถุดิบ</SelectItem>
                  <SelectItem value="CONSUMABLE">วัสดุสิ้นเปลือง</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>หมวดหมู่</Label>
                <Select name="categoryId">
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>หน่วย</Label>
                <Select name="unitId">
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหน่วย" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!hasVariants && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label>ราคาทุน</Label>
                  <Input
                    name="standardCost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Point</Label>
                  <Input
                    name="reorderPoint"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Qty</Label>
                  <Input
                    name="minQty"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Qty</Label>
                  <Input
                    name="maxQty"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Initial Stock Section */}
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${hasInitialStock ? 'bg-[var(--status-success)]' : 'bg-[var(--text-muted)]'}`} />
                <CardTitle className="text-base">สต๊อคเริ่มต้น</CardTitle>
                <span className="text-xs text-[var(--text-muted)]">(ไม่บังคับ)</span>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasInitialStock"
                  checked={hasInitialStock}
                  onCheckedChange={(checked) => setHasInitialStock(!!checked)}
                />
                <Label htmlFor="hasInitialStock" className="cursor-pointer">
                  ตั้งสต๊อคเริ่มต้น
                </Label>
              </div>
            </div>
          </CardHeader>

          {hasInitialStock && (
            <CardContent className="space-y-4 pt-0">
              <div className="bg-[var(--status-info-light)] border border-[var(--status-info)]/20 rounded-lg p-4">
                <p className="text-sm text-[var(--status-info)]">
                  💡 ระบบจะสร้างเอกสาร <strong>รับเข้า (RECEIVE)</strong> อัตโนมัติเพื่อเก็บประวัติการเคลื่อนไหว
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
                    Location <span className="text-[var(--status-error)]">*</span>
                  </Label>
                  <Select value={initialLocationId} onValueChange={setInitialLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.code} - {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {locations.length === 0 && (
                    <p className="text-xs text-[var(--status-warning)]">
                      ⚠️ ยังไม่มี Location กรุณาสร้างใน ตั้งค่า &gt; คลังสินค้า
                    </p>
                  )}
                </div>

                {!hasVariants && (
                  <div className="space-y-2">
                    <Label>จำนวนเริ่มต้น</Label>
                    <Input
                      type="number"
                      min="0"
                      value={initialQty || ''}
                      onChange={(e) => setInitialQty(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2 md:col-span-1">
                  <Label>หมายเหตุ</Label>
                  <Input
                    value={initialNote}
                    onChange={(e) => setInitialNote(e.target.value)}
                    placeholder="เช่น ยกยอดมา, สต๊อคเริ่มต้น"
                  />
                </div>
              </div>

              {hasVariants && variants.length > 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  📦 กรอกจำนวนสต๊อคในตาราง Variants ด้านล่าง (คอลัมน์ &quot;คลัง&quot;)
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Variants Section */}
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${hasVariants ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`} />
                <CardTitle className="text-base">ตัวเลือกสินค้า</CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasVariants"
                  checked={hasVariants}
                  onCheckedChange={(checked) => {
                    setHasVariants(!!checked)
                    if (!checked) {
                      setOptionGroups([])
                      setVariants([])
                    } else if (optionGroups.length === 0) {
                      addOptionGroup()
                    }
                  }}
                />
                <Label htmlFor="hasVariants" className="cursor-pointer">
                  เปิดใช้งานตัวเลือกสินค้า
                </Label>
              </div>
            </div>
          </CardHeader>

          {hasVariants && (
            <CardContent className="space-y-6 pt-0">
              {/* Option Groups */}
              {optionGroups.map((group, groupIndex) => (
                <div key={group.id} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-default)]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-[var(--text-muted)]">
                      กลุ่มตัวเลือกสินค้า {groupIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOptionGroup(group.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <Label className="text-sm">ชื่อกลุ่ม</Label>
                    <Input
                      placeholder="เช่น สี, ไซส์, แบบ"
                      value={group.name}
                      onChange={(e) => updateGroupName(group.id, e.target.value)}
                      className="max-w-xs"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-[var(--text-muted)]">ตัวเลือก</span>
                      <span className="text-[var(--accent-primary)]">*</span>
                      <span className="text-xs text-[var(--text-muted)] ml-2">(กด Enter เพื่อเพิ่ม)</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg min-h-[52px]">
                      {group.values.map((val) => (
                        <div key={val.id} className="group flex items-center gap-1">
                          {groupIndex === 0 && (
                            <button
                              type="button"
                              className="w-9 h-9 rounded border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] flex items-center justify-center transition-colors"
                              title="เพิ่มรูปภาพ"
                            >
                              <ImagePlus className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                          )}
                          <Badge 
                            variant="secondary" 
                            className="pl-3 pr-1 py-1.5 text-sm flex items-center gap-1.5"
                          >
                            {val.value}
                            <button
                              type="button"
                              onClick={() => removeValueFromGroup(group.id, val.id)}
                              className="ml-1 rounded-full hover:bg-[var(--bg-tertiary)] p-0.5 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </Badge>
                        </div>
                      ))}
                      
                      <input
                        type="text"
                        placeholder={group.values.length === 0 ? "พิมพ์ตัวเลือก แล้วกด Enter" : "เพิ่มตัวเลือก..."}
                        className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm"
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const input = e.currentTarget
                            const value = input.value.trim()
                            if (value) {
                              if (group.values.some(v => v.value.toLowerCase() === value.toLowerCase())) {
                                toast.error('ตัวเลือกนี้มีอยู่แล้ว')
                                return
                              }
                              addValueToGroup(group.id, value)
                              input.value = ''
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {optionGroups.length < 2 && (
                <button
                  type="button"
                  onClick={addOptionGroup}
                  className="w-full py-4 border-2 border-dashed border-[var(--border-default)] rounded-xl text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/50 transition-all flex items-center justify-center gap-2 bg-[var(--bg-secondary)]/50"
                >
                  <Plus className="w-5 h-5" />
                  <span>เพิ่มกลุ่มตัวเลือกสินค้า {optionGroups.length + 1}</span>
                  <span className="text-xs text-[var(--text-muted)]">({optionGroups.length}/2)</span>
                </button>
              )}

              {/* Variants Table */}
              {variants.length > 0 && (
                <div className="space-y-4 mt-6 pt-6 border-t border-[var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-[var(--accent-primary)] rounded-full" />
                      <span className="font-medium text-lg">รายการตัวเลือกสินค้า</span>
                      <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
                        {variants.length} รายการ
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVariants(variants.map((v) => {
                          const skuSuffix = v.options.map(o => 
                            o.value.replace(/\s+/g, '').substring(0, 3).toUpperCase()
                          ).join('-')
                          return { ...v, sku: baseSku ? `${baseSku}-${skuSuffix}` : skuSuffix }
                        }))
                        toast.success('อัปเดต SKU ทั้งหมดแล้ว')
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      สร้าง SKU อัตโนมัติ
                    </Button>
                  </div>

                  {/* Bulk Update Row */}
                  <div className="bg-[var(--accent-light)] border border-[var(--accent-primary)]/20 rounded-lg p-4 flex flex-wrap items-center gap-4">
                    <span className="text-sm text-[var(--accent-primary)] font-medium whitespace-nowrap">⚡ อัปเดตทั้งหมด:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">ราคาขาย</span>
                      <div className="flex items-center">
                        <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-2 py-1.5 text-sm">฿</span>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={bulkPrice}
                          onChange={(e) => setBulkPrice(e.target.value)}
                          className="w-24 h-8 rounded-l-none"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={applyBulkPrice}
                        className="h-8 text-xs"
                      >
                        ใช้ทั้งหมด
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">คลัง</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={bulkStock}
                        onChange={(e) => setBulkStock(e.target.value)}
                        className="w-20 h-8"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={applyBulkStock}
                        className="h-8 text-xs"
                      >
                        ใช้ทั้งหมด
                      </Button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto mobile-scroll">
                    <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        {optionGroups.map(g => (
                          <TableHead key={g.id} className="text-[var(--accent-primary)] font-medium">
                            {g.name || 'ตัวเลือก'}
                          </TableHead>
                        ))}
                        <TableHead>
                          <span className="text-[var(--accent-primary)]">*</span> ราคาขาย
                        </TableHead>
                        <TableHead>ราคาทุน</TableHead>
                        <TableHead>
                          <span className="text-[var(--accent-primary)]">*</span> คลัง
                        </TableHead>
                        <TableHead>SKU ย่อย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((variant, rowIndex) => {
                        const firstOptionValue = variant.options[0]?.value
                        const isFirstInGroup = rowIndex === 0 || 
                          variants[rowIndex - 1]?.options[0]?.value !== firstOptionValue
                        const groupSize = variants.filter(v => 
                          v.options[0]?.value === firstOptionValue
                        ).length

                        return (
                          <TableRow key={variant.id}>
                            {isFirstInGroup && optionGroups.length > 0 && (
                              <TableCell 
                                rowSpan={groupSize} 
                                className="border-r border-[var(--border-default)] align-middle font-medium bg-[var(--bg-secondary)]"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                                    {variant.options[0]?.value.charAt(0).toUpperCase()}
                                  </div>
                                  {variant.options[0]?.value}
                                </div>
                              </TableCell>
                            )}
                            
                            {optionGroups.length > 1 && (
                              <TableCell className="font-medium">
                                {variant.options[1]?.value}
                              </TableCell>
                            )}

                            <TableCell>
                              <div className="flex items-center">
                                <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-2 py-1.5 text-sm">฿</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={variant.sellingPrice || ''}
                                  onChange={(e) => updateVariant(variant.id, 'sellingPrice', Number(e.target.value))}
                                  placeholder="0"
                                  className="h-9 w-24 rounded-l-none"
                                />
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center">
                                <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-2 py-1.5 text-sm">฿</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={variant.costPrice || ''}
                                  onChange={(e) => updateVariant(variant.id, 'costPrice', Number(e.target.value))}
                                  placeholder="0"
                                  className="h-9 w-24 rounded-l-none"
                                />
                              </div>
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                value={variant.stock || ''}
                                onChange={(e) => updateVariant(variant.id, 'stock', Number(e.target.value))}
                                placeholder="0"
                                className="h-9 w-20"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                value={variant.sku}
                                onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                                placeholder="SKU"
                                className="h-9 font-mono text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 md:gap-3 mt-4 md:mt-6">
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/products">ยกเลิก</Link>
          </Button>
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกสินค้า'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
