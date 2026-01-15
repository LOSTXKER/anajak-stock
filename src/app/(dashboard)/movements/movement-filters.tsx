'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar, X } from 'lucide-react'

export function MovementDateFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')

  const applyFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (dateFrom) {
      params.set('dateFrom', dateFrom)
    } else {
      params.delete('dateFrom')
    }
    
    if (dateTo) {
      params.set('dateTo', dateTo)
    } else {
      params.delete('dateTo')
    }
    
    // Reset to page 1 when filter changes
    params.set('page', '1')
    
    router.push(`/movements?${params.toString()}`)
  }, [dateFrom, dateTo, searchParams, router])

  const clearFilter = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    
    const params = new URLSearchParams(searchParams.toString())
    params.delete('dateFrom')
    params.delete('dateTo')
    params.set('page', '1')
    
    router.push(`/movements?${params.toString()}`)
  }, [searchParams, router])

  const hasDateFilter = dateFrom || dateTo

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-muted)]">จากวันที่</Label>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="pl-8 w-[150px] text-sm"
          />
        </div>
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-muted)]">ถึงวันที่</Label>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="pl-8 w-[150px] text-sm"
          />
        </div>
      </div>
      
      <Button
        type="button"
        size="sm"
        onClick={applyFilter}
        className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
      >
        กรอง
      </Button>
      
      {hasDateFilter && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearFilter}
          className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
        >
          <X className="w-4 h-4 mr-1" />
          ล้าง
        </Button>
      )}
    </div>
  )
}
