'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, Filter, Loader2 } from 'lucide-react'
import { InlineScanButton } from '@/components/barcode-scanner'
import { useDebounce } from '@/hooks/use-debounce'
import type { Category } from '@/generated/prisma'

interface ProductSearchProps {
  categories: Category[]
}

export function ProductSearch({ categories }: ProductSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  
  // Debounce search for auto-search after typing
  const debouncedSearch = useDebounce(search, 500)
  
  // Auto-search when debounced search changes
  const performSearch = useCallback((searchVal: string, categoryVal: string) => {
    startTransition(() => {
      const params = new URLSearchParams()
      if (searchVal) params.set('search', searchVal)
      if (categoryVal && categoryVal !== 'all') params.set('category', categoryVal)
      router.push(`/products?${params.toString()}`)
    })
  }, [router])
  
  // Trigger search when debounced value changes
  useEffect(() => {
    const currentSearch = searchParams.get('search') || ''
    if (debouncedSearch !== currentSearch) {
      performSearch(debouncedSearch, category)
    }
  }, [debouncedSearch])

  function handleSearch() {
    performSearch(search, category)
  }
  
  // Auto-search when category changes
  function handleCategoryChange(value: string) {
    setCategory(value)
    performSearch(search, value)
  }

  function handleClear() {
    setSearch('')
    setCategory('')
    startTransition(() => {
      router.push('/products')
    })
  }

  function handleBarcodeSearch(barcode: string) {
    setSearch(barcode)
    startTransition(() => {
      router.push(`/products?search=${encodeURIComponent(barcode)}`)
    })
  }

  const hasFilters = search || (category && category !== 'all')

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Input with Barcode Scanner */}
          <div className="relative flex-1 min-w-[250px] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                placeholder="ค้นหา SKU, ชื่อสินค้า, Barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <InlineScanButton onScan={handleBarcodeSearch} />
          </div>

          {/* Category Filter */}
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
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

          {/* Action Buttons */}
          <Button onClick={handleSearch} disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            ค้นหา
          </Button>

          {hasFilters && (
            <Button variant="outline" onClick={handleClear}>
              <X className="w-4 h-4 mr-2" />
              ล้างตัวกรอง
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
