'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { startNavigation } from '@/components/navigation-progress'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar, X, FileText } from 'lucide-react'
import { DocStatus } from '@/generated/prisma'
import { movementStatusConfig } from '@/lib/status-config'

const statusFilterOptions: { value: DocStatus | null; label: string }[] = [
  { value: null, label: 'ทุกสถานะ' },
  { value: DocStatus.DRAFT, label: 'ร่าง' },
  { value: DocStatus.SUBMITTED, label: 'รออนุมัติ' },
  { value: DocStatus.APPROVED, label: 'อนุมัติแล้ว' },
  { value: DocStatus.REJECTED, label: 'ปฏิเสธ' },
  { value: DocStatus.POSTED, label: 'บันทึกแล้ว' },
  { value: DocStatus.CANCELLED, label: 'ยกเลิก' },
]

export function MovementStatusFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentStatus = searchParams.get('status') as DocStatus | null

  const handleStatusChange = useCallback((status: DocStatus | null) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (status) {
      params.set('status', status)
    } else {
      params.delete('status')
    }
    
    // Reset to page 1 when filter changes
    params.set('page', '1')
    
    startNavigation()
    router.push(`/movements?${params.toString()}`)
  }, [searchParams, router])

  return (
    <div className="flex flex-wrap gap-1.5">
      {statusFilterOptions.map((option) => {
        const isActive = currentStatus === option.value
        const statusConfig = option.value ? movementStatusConfig[option.value] : null
        
        return (
          <Button
            key={option.value || 'all'}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange(option.value)}
            className={isActive && statusConfig ? `${statusConfig.bgColor} ${statusConfig.color} border-transparent hover:opacity-80` : ''}
          >
            {statusConfig && statusConfig.icon}
            <span className={statusConfig ? 'ml-1' : ''}>{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}

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
    
    startNavigation()
    router.push(`/movements?${params.toString()}`)
  }, [dateFrom, dateTo, searchParams, router])

  const clearFilter = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    
    const params = new URLSearchParams(searchParams.toString())
    params.delete('dateFrom')
    params.delete('dateTo')
    params.set('page', '1')
    
    startNavigation()
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

export function MovementOrderRefFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [orderRef, setOrderRef] = useState(searchParams.get('orderRef') || '')

  const applyFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (orderRef.trim()) {
      params.set('orderRef', orderRef.trim())
    } else {
      params.delete('orderRef')
    }
    
    // Reset to page 1 when filter changes
    params.set('page', '1')
    
    startNavigation()
    router.push(`/movements?${params.toString()}`)
  }, [orderRef, searchParams, router])

  const clearFilter = useCallback(() => {
    setOrderRef('')
    
    const params = new URLSearchParams(searchParams.toString())
    params.delete('orderRef')
    params.set('page', '1')
    
    startNavigation()
    router.push(`/movements?${params.toString()}`)
  }, [searchParams, router])

  const hasFilter = searchParams.get('orderRef')

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyFilter()
    }
  }, [applyFilter])

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-muted)]">เลขออเดอร์</Label>
        <div className="relative">
          <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            type="text"
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ค้นหาเลขออเดอร์..."
            className="pl-8 w-[180px] text-sm"
          />
        </div>
      </div>
      
      <Button
        type="button"
        size="sm"
        onClick={applyFilter}
        className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
      >
        ค้นหา
      </Button>
      
      {hasFilter && (
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
