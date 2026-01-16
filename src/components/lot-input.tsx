'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Package, Calendar as CalendarIcon, Plus, ChevronDown, Check } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface LotBalance {
  qtyOnHand: number
  location: {
    id: string
    code: string
  }
}

interface ExistingLot {
  id: string
  lotNumber: string
  expiryDate: string | null
  totalQtyOnHand: number
  balances: LotBalance[]
}

interface LotInputProps {
  productId: string
  variantId?: string
  locationId?: string
  mode: 'receive' | 'issue' | 'transfer'
  // For existing lot selection
  selectedLotId?: string
  // For new lot creation
  newLotNumber?: string
  newExpiryDate?: string
  // Callbacks
  onSelectExisting: (lot: ExistingLot | null) => void
  onCreateNew: (lotNumber: string, expiryDate?: string) => void
  onClear: () => void
  disabled?: boolean
}

export function LotInput({
  productId,
  variantId,
  locationId,
  mode,
  selectedLotId,
  newLotNumber,
  newExpiryDate,
  onSelectExisting,
  onCreateNew,
  onClear,
  disabled = false,
}: LotInputProps) {
  const [existingLots, setExistingLots] = useState<ExistingLot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [lotNumberInput, setLotNumberInput] = useState(newLotNumber || '')
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    newExpiryDate ? new Date(newExpiryDate) : undefined
  )
  const [isOpen, setIsOpen] = useState(false)

  // Load existing lots
  useEffect(() => {
    if (!productId) {
      setExistingLots([])
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
            let filteredLots = result.data
            // Filter by location for ISSUE/TRANSFER
            if (locationId && mode !== 'receive') {
              filteredLots = result.data.filter((lot: ExistingLot) => 
                lot.balances.some(b => b.location.id === locationId && b.qtyOnHand > 0)
              )
            }
            setExistingLots(filteredLots)
          }
        }
      } catch (error) {
        console.error('Failed to load lots:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLots()
  }, [productId, variantId, locationId, mode])

  // Sync external newLotNumber changes
  useEffect(() => {
    if (newLotNumber !== undefined) {
      setLotNumberInput(newLotNumber)
      if (newLotNumber) setIsCreatingNew(true)
    }
  }, [newLotNumber])

  const selectedLot = existingLots.find(l => l.id === selectedLotId)

  const handleSelectExisting = (lot: ExistingLot) => {
    setIsCreatingNew(false)
    setLotNumberInput('')
    setExpiryDate(undefined)
    onSelectExisting(lot)
    setIsOpen(false)
  }

  const handleCreateNew = () => {
    if (lotNumberInput.trim()) {
      onCreateNew(lotNumberInput.trim(), expiryDate?.toISOString())
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setIsCreatingNew(false)
    setLotNumberInput('')
    setExpiryDate(undefined)
    onClear()
  }

  const getQtyInLocation = (lot: ExistingLot) => {
    if (!locationId) return lot.totalQtyOnHand
    const balance = lot.balances.find(b => b.location.id === locationId)
    return balance?.qtyOnHand || 0
  }

  // Display value
  const displayValue = () => {
    if (selectedLot) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{selectedLot.lotNumber}</span>
          {mode !== 'receive' && (
            <Badge variant="secondary" className="text-xs">
              {getQtyInLocation(selectedLot).toLocaleString()}
            </Badge>
          )}
        </div>
      )
    }
    if (newLotNumber) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs bg-[var(--status-success-light)] text-[var(--status-success)]">
            ใหม่
          </Badge>
          <span className="font-mono text-sm">{newLotNumber}</span>
        </div>
      )
    }
    return <span className="text-[var(--text-muted)]">เลือก/สร้าง Lot</span>
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between font-normal",
            !selectedLot && !newLotNumber && "text-[var(--text-muted)]"
          )}
          disabled={disabled || !productId}
        >
          {displayValue()}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Create New Lot Section - Only for RECEIVE */}
          {mode === 'receive' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <Plus className="w-4 h-4" />
                สร้าง Lot ใหม่
              </div>
              <div className="space-y-2 pl-6">
                <Input
                  placeholder="หมายเลข Lot (เช่น LOT2025-001)"
                  value={lotNumberInput}
                  onChange={(e) => {
                    setLotNumberInput(e.target.value)
                    setIsCreatingNew(true)
                    if (selectedLotId) onSelectExisting(null)
                  }}
                  className="font-mono text-sm"
                />
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                  <Input
                    type="date"
                    value={expiryDate ? format(expiryDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined
                      setExpiryDate(date)
                      setIsCreatingNew(true)
                    }}
                    className="pl-9 text-sm"
                    placeholder="วันหมดอายุ"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!lotNumberInput.trim()}
                  onClick={handleCreateNew}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  สร้าง Lot
                </Button>
              </div>
            </div>
          )}

          {/* Existing Lots Section */}
          {existingLots.length > 0 && (
            <>
              {mode === 'receive' && (
                <div className="border-t border-[var(--border-default)] pt-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] mb-2">
                    <Package className="w-4 h-4" />
                    เลือก Lot ที่มีอยู่
                  </div>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {existingLots.map((lot) => {
                  const qtyAvailable = getQtyInLocation(lot)
                  const isExpiringSoon = lot.expiryDate && 
                    new Date(lot.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  const isSelected = lot.id === selectedLotId

                  return (
                    <button
                      key={lot.id}
                      onClick={() => handleSelectExisting(lot)}
                      className={cn(
                        "w-full text-left p-2 rounded-lg transition-colors",
                        isSelected 
                          ? "bg-[var(--accent-light)] border border-[var(--accent-primary)]" 
                          : "hover:bg-[var(--bg-hover)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isSelected && <Check className="w-4 h-4 text-[var(--accent-primary)]" />}
                          <span className="font-mono text-sm">{lot.lotNumber}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {mode !== 'receive' && (
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-xs",
                                qtyAvailable <= 0 && "bg-[var(--status-error-light)] text-[var(--status-error)]"
                              )}
                            >
                              {qtyAvailable.toLocaleString()} ชิ้น
                            </Badge>
                          )}
                          {isExpiringSoon && (
                            <Badge variant="secondary" className="text-xs bg-[var(--status-warning-light)] text-[var(--status-warning)]">
                              ใกล้หมดอายุ
                            </Badge>
                          )}
                        </div>
                      </div>
                      {lot.expiryDate && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1 ml-6">
                          <CalendarIcon className="w-3 h-3" />
                          หมดอายุ: {format(new Date(lot.expiryDate), 'd MMM yy', { locale: th })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* No Lots Message */}
          {!isLoading && existingLots.length === 0 && mode !== 'receive' && (
            <div className="text-center py-4 text-[var(--text-muted)] text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              ไม่มี Lot ที่มีสินค้า
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="text-center py-4 text-[var(--text-muted)] text-sm">
              กำลังโหลด...
            </div>
          )}

          {/* Clear Button */}
          {(selectedLotId || newLotNumber) && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[var(--text-muted)]"
              onClick={handleClear}
            >
              ล้างการเลือก
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
