'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Search, X } from 'lucide-react'
import type { Category, Warehouse, Location } from '@/generated/prisma'

interface StockSearchProps {
  warehouses: (Warehouse & { locations: Location[] })[]
  categories: Category[]
}

export function StockSearch({ warehouses, categories }: StockSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [warehouse, setWarehouse] = useState(searchParams.get('warehouse') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [lowStock, setLowStock] = useState(searchParams.get('lowStock') === 'true')

  function handleSearch() {
    startTransition(() => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (warehouse) params.set('warehouse', warehouse)
      if (category) params.set('category', category)
      if (lowStock) params.set('lowStock', 'true')
      router.push(`/stock?${params.toString()}`)
    })
  }

  function handleClear() {
    setSearch('')
    setWarehouse('')
    setCategory('')
    setLowStock(false)
    startTransition(() => {
      router.push('/stock')
    })
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <Input
          placeholder="ค้นหา SKU, ชื่อสินค้า..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pl-9"
        />
      </div>

      <Select value={warehouse} onValueChange={setWarehouse}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="คลังทั้งหมด" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">คลังทั้งหมด</SelectItem>
          {warehouses.map((wh) => (
            <SelectItem key={wh.id} value={wh.id}>
              {wh.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="หมวดหมู่ทั้งหมด" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">หมวดหมู่ทั้งหมด</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Checkbox
          id="lowStock"
          checked={lowStock}
          onCheckedChange={(checked) => setLowStock(checked === true)}
        />
        <Label htmlFor="lowStock" className="text-sm text-[var(--text-secondary)] cursor-pointer">
          เฉพาะใกล้หมด
        </Label>
      </div>

      <Button onClick={handleSearch} disabled={isPending}>
        <Search className="w-4 h-4 mr-2" />
        ค้นหา
      </Button>

      {(search || warehouse || category || lowStock) && (
        <Button variant="outline" onClick={handleClear}>
          <X className="w-4 h-4 mr-2" />
          ล้าง
        </Button>
      )}
    </div>
  )
}
