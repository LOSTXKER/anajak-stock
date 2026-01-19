'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClipboardCheck, ArrowLeft, Save, Warehouse, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createStockTake, getWarehouses } from '@/actions/stock-take'
import { PageHeader } from '@/components/common'

interface WarehouseOption {
  id: string
  code: string
  name: string
}

export default function NewStockTakePage() {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true)

  useEffect(() => {
    async function loadWarehouses() {
      const result = await getWarehouses()
      if (result.success) {
        setWarehouses(result.data)
      }
      setIsLoadingWarehouses(false)
    }
    loadWarehouses()
  }, [])

  const handleSubmit = async () => {
    if (!selectedWarehouse) {
      toast.error('กรุณาเลือกคลังสินค้า')
      return
    }

    setIsLoading(true)
    try {
      const result = await createStockTake({
        warehouseId: selectedWarehouse,
        note: note || undefined,
      })

      if (result.success) {
        toast.success('สร้างใบตรวจนับสำเร็จ')
        router.push(`/stock-take/${result.data.id}`)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedWh = warehouses.find(w => w.id === selectedWarehouse)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stock-take">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="สร้างใบตรวจนับ"
          description="เลือกคลังสินค้าเพื่อสร้างใบตรวจนับ"
          icon={<ClipboardCheck className="w-6 h-6" />}
        />
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-[var(--accent-primary)]" />
            เลือกคลังสินค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>คลังสินค้า <span className="text-[var(--status-error)]">*</span></Label>
            {isLoadingWarehouses ? (
              <div className="h-10 bg-[var(--bg-secondary)] rounded-md animate-pulse" />
            ) : (
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className={!selectedWarehouse ? 'border-[var(--status-error)]/50' : ''}>
                  <SelectValue placeholder="เลือกคลังสินค้า" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      <div className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-[var(--text-muted)]" />
                        {wh.name}
                        <span className="font-mono text-xs text-[var(--text-muted)]">({wh.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-sm text-[var(--text-muted)]">
              ระบบจะดึงสินค้าที่มีสต๊อคในคลังนี้มาให้นับทั้งหมด
            </p>
          </div>

          {selectedWh && (
            <div className="p-4 bg-[var(--accent-light)] border border-[var(--accent-primary)]/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center">
                  <Warehouse className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <div className="font-medium">{selectedWh.name}</div>
                  <div className="text-sm text-[var(--text-muted)] font-mono">{selectedWh.code}</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>หมายเหตุ (ถ้ามี)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ระบุหมายเหตุเพิ่มเติม..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-[var(--border-default)]">
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !selectedWarehouse}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              สร้างใบตรวจนับ
            </Button>
            <Button variant="outline" asChild>
              <Link href="/stock-take">ยกเลิก</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
