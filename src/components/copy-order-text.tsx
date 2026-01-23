'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface OrderLine {
  productName: string
  variantName?: string
  sku: string
  qty: number
  unitPrice?: number
}

interface CopyOrderTextProps {
  docNumber: string
  docType: 'PO' | 'PR'
  supplierName?: string
  lines: OrderLine[]
  totalAmount?: number
  note?: string
}

export function CopyOrderText({
  docNumber,
  docType,
  supplierName,
  lines,
  totalAmount,
  note,
}: CopyOrderTextProps) {
  const [copied, setCopied] = useState<'simple' | 'detailed' | null>(null)

  // แบบย่อ - ส่ง Supplier (สี/ไซส์ + จำนวน)
  function generateSimpleText() {
    let text = ''
    
    lines.forEach((line, index) => {
      const variant = line.variantName || '-'
      text += `${index + 1}. ${variant} x ${line.qty.toLocaleString()}\n`
    })
    
    return text.trim()
  }

  // แบบละเอียด - ใช้ภายใน
  function generateDetailedText() {
    const icon = docType === 'PO' ? '🛒' : '📋'
    const typeLabel = docType === 'PO' ? 'ใบสั่งซื้อ' : 'ใบขอซื้อ'
    
    let text = `${icon} ${typeLabel}: ${docNumber}\n`
    
    if (supplierName) {
      text += `🏢 Supplier: ${supplierName}\n`
    }
    
    text += `\n📦 รายการสินค้า:\n`
    text += `${'─'.repeat(30)}\n`
    
    lines.forEach((line, index) => {
      const itemNum = `${index + 1}.`
      const name = line.variantName 
        ? `${line.productName} (${line.variantName})`
        : line.productName
      
      if (line.unitPrice !== undefined) {
        const lineTotal = line.qty * line.unitPrice
        text += `${itemNum} ${name}\n`
        text += `   SKU: ${line.sku}\n`
        text += `   จำนวน: ${line.qty.toLocaleString()} x ฿${line.unitPrice.toLocaleString()} = ฿${lineTotal.toLocaleString()}\n`
      } else {
        text += `${itemNum} ${name}\n`
        text += `   SKU: ${line.sku}\n`
        text += `   จำนวน: ${line.qty.toLocaleString()}\n`
      }
    })
    
    if (totalAmount !== undefined) {
      text += `${'─'.repeat(30)}\n`
      text += `💰 รวมทั้งสิ้น: ฿${totalAmount.toLocaleString()}\n`
    }
    
    if (note) {
      text += `\n📝 หมายเหตุ: ${note}\n`
    }
    
    return text
  }

  async function handleCopy(type: 'simple' | 'detailed') {
    const text = type === 'simple' ? generateSimpleText() : generateDetailedText()
    
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      toast.success(type === 'simple' ? 'คัดลอกแบบย่อแล้ว' : 'คัดลอกแบบละเอียดแล้ว')
      
      setTimeout(() => {
        setCopied(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('ไม่สามารถคัดลอกได้')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {copied ? (
            <Check className="w-4 h-4 text-[var(--status-success)]" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          คัดลอก
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCopy('simple')}>
          <div>
            <p className="font-medium">แบบย่อ (ส่ง Supplier)</p>
            <p className="text-xs text-[var(--text-muted)]">สี/ไซส์ + จำนวน</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy('detailed')}>
          <div>
            <p className="font-medium">แบบละเอียด</p>
            <p className="text-xs text-[var(--text-muted)]">รวม SKU, ราคา, หมายเหตุ</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
