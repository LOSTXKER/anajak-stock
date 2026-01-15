'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Package, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface LotBalance {
  qtyOnHand: number
  location: {
    id: string
    code: string
  }
}

interface Lot {
  id: string
  lotNumber: string
  expiryDate: string | null
  totalQtyOnHand: number
  balances: LotBalance[]
}

interface LotSelectorProps {
  productId: string
  variantId?: string
  locationId?: string
  selectedLotId?: string
  onSelect: (lot: Lot | null) => void
  disabled?: boolean
}

export function LotSelector({
  productId,
  variantId,
  locationId,
  selectedLotId,
  onSelect,
  disabled = false,
}: LotSelectorProps) {
  const [lots, setLots] = useState<Lot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLots, setHasLots] = useState(false)

  useEffect(() => {
    if (!productId) {
      setLots([])
      setHasLots(false)
      return
    }

    async function loadLots() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ productId })
        if (variantId) params.set('variantId', variantId)
        
        const response = await fetch(`/api/lots?${params.toString()}`)
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            // Filter lots that have qty in the selected location (if specified)
            let filteredLots = result.data
            if (locationId) {
              filteredLots = result.data.filter((lot: Lot) => 
                lot.balances.some(b => b.location.id === locationId && b.qtyOnHand > 0)
              )
            }
            setLots(filteredLots)
            setHasLots(result.data.length > 0)
          }
        }
      } catch (error) {
        console.error('Failed to load lots:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLots()
  }, [productId, variantId, locationId])

  // If no lots exist for this product, don't render anything
  if (!hasLots && !isLoading) {
    return null
  }

  if (isLoading) {
    return (
      <div className="text-[var(--text-muted)] text-sm animate-pulse">
        กำลังโหลด Lot...
      </div>
    )
  }

  if (lots.length === 0) {
    return (
      <div className="text-[var(--status-warning)] text-sm flex items-center gap-1">
        <Package className="w-4 h-4" />
        ไม่มี Lot ที่มีสินค้า
      </div>
    )
  }

  const selectedLot = lots.find(l => l.id === selectedLotId)

  const getQtyInLocation = (lot: Lot) => {
    if (!locationId) return lot.totalQtyOnHand
    const balance = lot.balances.find(b => b.location.id === locationId)
    return balance?.qtyOnHand || 0
  }

  return (
    <Select
      value={selectedLotId || ''}
      onValueChange={(value) => {
        const lot = lots.find(l => l.id === value)
        onSelect(lot || null)
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="เลือก Lot *">
          {selectedLot && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{selectedLot.lotNumber}</span>
              <Badge variant="secondary" className="text-xs">
                {getQtyInLocation(selectedLot).toLocaleString()} ชิ้น
              </Badge>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {lots.map((lot) => {
          const qtyAvailable = getQtyInLocation(lot)
          const isExpiringSoon = lot.expiryDate && 
            new Date(lot.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          
          return (
            <SelectItem key={lot.id} value={lot.id}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{lot.lotNumber}</span>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${qtyAvailable <= 0 ? 'bg-[var(--status-error-light)] text-[var(--status-error)]' : ''}`}
                  >
                    {qtyAvailable.toLocaleString()} ชิ้น
                  </Badge>
                  {isExpiringSoon && (
                    <Badge variant="secondary" className="text-xs bg-[var(--status-warning-light)] text-[var(--status-warning)]">
                      ใกล้หมดอายุ
                    </Badge>
                  )}
                </div>
                {lot.expiryDate && (
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Calendar className="w-3 h-3" />
                    หมดอายุ: {format(new Date(lot.expiryDate), 'd MMM yy', { locale: th })}
                  </div>
                )}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
