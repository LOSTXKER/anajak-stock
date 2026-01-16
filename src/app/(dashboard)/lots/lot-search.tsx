'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Loader2 } from 'lucide-react'
import { startNavigation } from '@/components/navigation-progress'

export function LotSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')

  function handleSearch() {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status !== 'all') params.set('status', status)
    
    startNavigation()
    startTransition(() => {
      router.push(`/lots?${params.toString()}`)
    })
  }

  function handleClear() {
    setSearch('')
    setStatus('all')
    startNavigation()
    startTransition(() => {
      router.push('/lots')
    })
  }

  function handleStatusChange(value: string) {
    setStatus(value)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (value !== 'all') params.set('status', value)
    
    startNavigation()
    startTransition(() => {
      router.push(`/lots?${params.toString()}`)
    })
  }

  const hasFilters = search || status !== 'all'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              placeholder="ค้นหา Lot, SKU, ชื่อสินค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="in_stock">มีสต๊อค</SelectItem>
              <SelectItem value="expiring_soon">ใกล้หมดอายุ (30 วัน)</SelectItem>
              <SelectItem value="expired">หมดอายุแล้ว</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleSearch} disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            ค้นหา
          </Button>

          {hasFilters && (
            <Button variant="ghost" onClick={handleClear} disabled={isPending}>
              <X className="w-4 h-4 mr-2" />
              ล้าง
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
