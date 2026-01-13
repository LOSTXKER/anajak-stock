'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { getLowStockForAutoPR, createAutoPR } from '@/actions/auto-pr'
import { toast } from 'sonner'

interface LowStockItem {
  productId: string
  productSku: string
  productName: string
  currentQty: number
  reorderPoint: number
  suggestedQty: number
}

export default function AutoPRPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isCreating, setIsCreating] = useState(false)
  const [items, setItems] = useState<LowStockItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    loadItems()
  }, [])

  function loadItems() {
    startTransition(async () => {
      const data = await getLowStockForAutoPR()
      setItems(data)
      // Select all by default
      setSelectedIds(data.map((item) => item.productId))
    })
  }

  function toggleItem(productId: string) {
    setSelectedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  function toggleAll() {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((item) => item.productId))
    }
  }

  async function handleCreatePR() {
    if (selectedIds.length === 0) {
      toast.error('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
      return
    }

    setIsCreating(true)
    const result = await createAutoPR(selectedIds)
    setIsCreating(false)

    if (result.success) {
      toast.success(`สร้าง PR ${result.data.prNumber} เรียบร้อยแล้ว`)
      router.push(`/pr/${result.data.prId}`)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[var(--status-warning)]" />
            สร้าง PR อัตโนมัติ
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            เลือกสินค้าที่ต้องการสั่งซื้อจากรายการใกล้หมด
          </p>
        </div>
        <Button
          onClick={handleCreatePR}
          disabled={isCreating || selectedIds.length === 0}
          className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังสร้าง...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              สร้าง PR ({selectedIds.length} รายการ)
            </>
          )}
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[var(--text-primary)]">
              สินค้าใกล้หมด ({items.length} รายการ)
            </CardTitle>
            {items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
                className="border-[var(--border-default)] text-[var(--text-secondary)]"
              >
                {selectedIds.length === items.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--border-default)] hover:bg-transparent">
                <TableHead className="w-12 text-[var(--text-muted)]">
                  <Checkbox
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onCheckedChange={toggleAll}
                    className="border-[var(--border-default)]"
                  />
                </TableHead>
                <TableHead className="text-[var(--text-muted)]">SKU</TableHead>
                <TableHead className="text-[var(--text-muted)]">สินค้า</TableHead>
                <TableHead className="text-[var(--text-muted)] text-right">คงเหลือ</TableHead>
                <TableHead className="text-[var(--text-muted)] text-right">ROP</TableHead>
                <TableHead className="text-[var(--text-muted)] text-right">แนะนำสั่ง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)] mx-auto" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                      <AlertTriangle className="w-8 h-8" />
                      <p>ไม่มีสินค้าใกล้หมด</p>
                      <p className="text-sm">ยอดสินค้าทั้งหมดอยู่เหนือ Reorder Point</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item.productId}
                    className="border-[var(--border-default)] hover:bg-[var(--bg-hover)] cursor-pointer"
                    onClick={() => toggleItem(item.productId)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(item.productId)}
                        onCheckedChange={() => toggleItem(item.productId)}
                        className="border-[var(--border-default)]"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                      {item.productSku}
                    </TableCell>
                    <TableCell className="text-[var(--text-primary)] font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.currentQty === 0
                            ? 'text-[var(--status-error)] font-bold'
                            : 'text-[var(--status-warning)] font-bold'
                        }
                      >
                        {item.currentQty.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[var(--text-muted)]">
                      {item.reorderPoint.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[var(--status-success)] font-mono font-bold">
                      {item.suggestedQty.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardContent className="py-4">
          <p className="text-sm text-[var(--text-muted)]">
            <strong className="text-[var(--text-primary)]">หมายเหตุ:</strong> ระบบจะสร้าง PR ฉบับร่างพร้อมรายการสินค้าที่เลือก
            จำนวนที่แนะนำคำนวณจาก Max Qty หรือ 3 เท่าของ Reorder Point
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
