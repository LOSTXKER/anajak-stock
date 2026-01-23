'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  function generateText() {
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

  async function handleCopy() {
    const text = generateText()
    
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('คัดลอกข้อความแล้ว')
      
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('ไม่สามารถคัดลอกได้')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-2"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-[var(--status-success)]" />
          คัดลอกแล้ว
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          คัดลอกรายการ
        </>
      )}
    </Button>
  )
}

// Short format for quick sharing
export function CopyOrderTextShort({
  docNumber,
  docType,
  lines,
}: Pick<CopyOrderTextProps, 'docNumber' | 'docType' | 'lines'>) {
  const [copied, setCopied] = useState(false)

  function generateShortText() {
    const icon = docType === 'PO' ? '🛒' : '📋'
    
    let text = `${icon} ${docNumber}\n\n`
    
    lines.forEach((line, index) => {
      const name = line.variantName 
        ? `${line.productName} (${line.variantName})`
        : line.productName
      text += `${index + 1}. ${name} x${line.qty.toLocaleString()}\n`
    })
    
    return text.trim()
  }

  async function handleCopy() {
    const text = generateShortText()
    
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('คัดลอกข้อความแล้ว')
      
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('ไม่สามารถคัดลอกได้')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      title="คัดลอกรายการ (แบบย่อ)"
      className="h-8 w-8"
    >
      {copied ? (
        <Check className="w-4 h-4 text-[var(--status-success)]" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
  )
}
