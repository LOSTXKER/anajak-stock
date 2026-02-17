'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeftRight, ArrowLeft, Loader2, Plus, Trash2, Send, Save, Package, ArrowDown, ArrowUp, RefreshCw, CornerDownRight, Scan, ListPlus, FileText, ArrowRight } from 'lucide-react'
import { BulkAddModal, BulkAddResult, BulkAddVariant } from '@/components/bulk-add-modal'
import { createMovement, submitMovement, getMovement, getIssuedMovements, getIssuedMovementForReturn } from '@/actions/movements'
import { getProducts, getProductByBarcode } from '@/actions/products'
import { getLocations, getStockByProductVariantLocation } from '@/actions/stock'

import { toast } from 'sonner'
import { MovementType } from '@/generated/prisma'
import { PageHeader, HelpTooltip } from '@/components/common'
import { CascadingVariantPicker } from '@/components/variants'
import { LotInput } from '@/components/lot-input'
import { BarcodeInput, useBarcodeScanner, InlineScanButton } from '@/components/barcode-scanner'
import {
  createStockMapKey,
  type MovementLine,
  type ProductWithVariants,
  type Variant,
  type IssuedMovementSummary,
  type LocationWithWarehouse,
} from './types'

interface PageProps {
  searchParams: Promise<{ type?: MovementType; refId?: string }>
}

const typeConfig: Record<MovementType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  RECEIVE: { 
    label: 'รับเข้า', 
    icon: <ArrowDown className="w-4 h-4" />, 
    color: 'bg-[var(--status-success-light)] text-[var(--status-success)]',
    description: 'รับสินค้าเข้าคลัง'
  },
  ISSUE: { 
    label: 'เบิกออก', 
    icon: <ArrowUp className="w-4 h-4" />, 
    color: 'bg-[var(--status-error-light)] text-[var(--status-error)]',
    description: 'เบิกสินค้าออกจากคลัง'
  },
  TRANSFER: { 
    label: 'โอนย้าย', 
    icon: <ArrowLeftRight className="w-4 h-4" />, 
    color: 'bg-[var(--status-info-light)] text-[var(--status-info)]',
    description: 'โอนย้ายระหว่างโลเคชัน'
  },
  ADJUST: { 
    label: 'ปรับยอด', 
    icon: <RefreshCw className="w-4 h-4" />, 
    color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]',
    description: 'ปรับยอดสต็อก'
  },
  RETURN: { 
    label: 'คืนของ', 
    icon: <CornerDownRight className="w-4 h-4" />, 
    color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]',
    description: 'คืนสินค้า'
  },
}

export default function NewMovementPage(props: PageProps) {
  const searchParams = use(props.searchParams)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [type, setType] = useState<MovementType>(searchParams.type || MovementType.ISSUE)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [lines, setLines] = useState<MovementLine[]>([])
  const [refId, setRefId] = useState<string | undefined>(searchParams.refId)
  const [refDocNumber, setRefDocNumber] = useState<string | null>(null)
  const [showBarcodeInput, setShowBarcodeInput] = useState(false)
  const [isScanningBarcode, setIsScanningBarcode] = useState(false)

  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [locations, setLocations] = useState<LocationWithWarehouse[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [loadingVariantFor, setLoadingVariantFor] = useState<string | null>(null)
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)
  const [loadedVariants, setLoadedVariants] = useState<Record<string, Variant[]>>({})
  
  // Stock tracking for ADJUST/TRANSFER modes
  const [stockCache, setStockCache] = useState<Map<string, number>>(new Map())
  const [loadingStock, setLoadingStock] = useState<Set<string>>(new Set())
  
  // Issued movements for RETURN mode
  const [issuedMovements, setIssuedMovements] = useState<IssuedMovementSummary[]>([])
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [isLoadingIssues, setIsLoadingIssues] = useState(false)

  // Handle barcode scan - add product to lines
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setIsScanningBarcode(true)
    try {
      const result = await getProductByBarcode(barcode)
      if (!result) {
        toast.error(`ไม่พบสินค้า: ${barcode}`)
        return
      }

      const existingLine = lines.find(l => 
        l.productId === result.product.id && !l.variantId
      )

      if (existingLine && !result.product.hasVariants) {
        // Increment quantity if product already exists (and no variants)
        setLines(prev => prev.map(l => 
          l.id === existingLine.id 
            ? { ...l, qty: l.qty + 1 }
            : l
        ))
        toast.success(`เพิ่มจำนวน: ${result.product.name}`)
      } else {
        // Add new line
        const newLine: MovementLine = {
          id: Math.random().toString(36).substr(2, 9),
          productId: result.product.id,
          productName: result.product.name,
          qty: 1,
          unitCost: Number(result.product.lastCost || result.product.standardCost || 0),
        }
        setLines(prev => [...prev, newLine])
        
        // Load variants if needed (loadVariantsForProduct handles caching)
        if (result.product.hasVariants) {
          await loadVariantsForProduct(result.product.id)
        }
        
        toast.success(`เพิ่มสินค้า: ${result.product.name}`)
      }
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('เกิดข้อผิดพลาดในการสแกน')
    } finally {
      setIsScanningBarcode(false)
    }
  }, [lines])

  // USB Scanner hook - listen for barcode scans
  useBarcodeScanner(handleBarcodeScan, !showBarcodeInput)
  
  // Function to get current stock for a product/variant/location
  const fetchCurrentStock = useCallback(async (
    productId: string,
    variantId: string | null | undefined,
    locationId: string
  ): Promise<number> => {
    const key = createStockMapKey(productId, variantId || null, locationId)
    
    // Check cache first
    if (stockCache.has(key)) {
      return stockCache.get(key)!
    }
    
    // Mark as loading
    setLoadingStock(prev => new Set(prev).add(key))
    
    try {
      const qty = await getStockByProductVariantLocation(productId, variantId || null, locationId)
      setStockCache(prev => new Map(prev).set(key, qty))
      return qty
    } finally {
      setLoadingStock(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [stockCache])
  
  // Get stock from cache (returns undefined if not loaded)
  const getStockFromCache = useCallback((
    productId: string,
    variantId: string | null | undefined,
    locationId: string
  ): number | undefined => {
    const key = createStockMapKey(productId, variantId || null, locationId)
    return stockCache.get(key)
  }, [stockCache])
  
  // Check if stock is loading
  const isStockLoading = useCallback((
    productId: string,
    variantId: string | null | undefined,
    locationId: string
  ): boolean => {
    const key = createStockMapKey(productId, variantId || null, locationId)
    return loadingStock.has(key)
  }, [loadingStock])
  
  // Load issued movements for RETURN mode
  const loadIssuedMovements = useCallback(async () => {
    setIsLoadingIssues(true)
    try {
      const result = await getIssuedMovements({ limit: 50 })
      setIssuedMovements(result.items as IssuedMovementSummary[])
    } catch (error) {
      console.error('Failed to load issued movements:', error)
    } finally {
      setIsLoadingIssues(false)
    }
  }, [])
  
  // Handle selecting an issued movement for RETURN
  const handleSelectIssuedMovement = useCallback(async (issueId: string) => {
    setSelectedIssueId(issueId)
    
    const issueData = await getIssuedMovementForReturn(issueId)
    if (!issueData) {
      toast.error('ไม่พบใบเบิก')
      return
    }
    
    setRefId(issueId)
    setRefDocNumber(issueData.docNumber)
    setNote(`คืนของจาก ${issueData.docNumber}`)
    setReason('คืนสินค้าจากการเบิก')
    
    // Create lines from the issued movement
    const newLines: MovementLine[] = issueData.lines
      .filter(line => line.remainingQty > 0)
      .map((line) => ({
        id: Math.random().toString(36).substr(2, 9),
        productId: line.productId,
        variantId: line.variantId || undefined,
        productName: line.productName,
        variantLabel: line.variantName || undefined,
        // For RETURN, destination is the source of issue (return to where it was issued from)
        toLocationId: line.fromLocationId || undefined,
        qty: line.remainingQty, // Default to remaining qty
        unitCost: 0,
        issuedQty: line.issuedQty,
        returnedQty: line.returnedQty,
        remainingQty: line.remainingQty,
      }))
    
    setLines(newLines)
    
    // Preload products if needed
    for (const line of issueData.lines) {
      if (line.variantId) {
        await loadVariantsForProduct(line.productId)
      }
    }
  }, [])

  useEffect(() => {
    async function loadData() {
      setIsLoadingProducts(true)
      const [productsResult, locationsData] = await Promise.all([
        getProducts({ limit: 1000 }),
        getLocations(),
      ])
      setProducts(productsResult.items.map(p => ({
        ...p,
        hasVariants: p.hasVariants || false,
        variants: undefined,
      })))
      setLocations(locationsData as LocationWithWarehouse[])
      setIsLoadingProducts(false)

      // If refId is provided (return from issue), load the original movement
      if (searchParams.refId && searchParams.type === MovementType.RETURN) {
        await handleSelectIssuedMovement(searchParams.refId)
      }
    }
    loadData()
  }, [searchParams.refId, searchParams.type, handleSelectIssuedMovement])
  
  // Load issued movements when type is RETURN
  useEffect(() => {
    if (type === MovementType.RETURN && !searchParams.refId) {
      loadIssuedMovements()
    }
  }, [type, searchParams.refId, loadIssuedMovements])
  
  // Fetch stock for lines when needed (ADJUST, TRANSFER modes)
  useEffect(() => {
    if (type !== MovementType.ADJUST && type !== MovementType.TRANSFER && type !== MovementType.RETURN) {
      return
    }
    
    // Fetch stock for each line that has product/location selected
    for (const line of lines) {
      if (!line.productId) continue
      
      // For ADJUST - fetch stock at destination location
      if (type === MovementType.ADJUST && line.toLocationId) {
        const key = createStockMapKey(line.productId, line.variantId || null, line.toLocationId)
        if (!stockCache.has(key) && !loadingStock.has(key)) {
          fetchCurrentStock(line.productId, line.variantId, line.toLocationId)
        }
      }
      
      // For TRANSFER - fetch stock at both source and destination
      if (type === MovementType.TRANSFER) {
        if (line.fromLocationId) {
          const fromKey = createStockMapKey(line.productId, line.variantId || null, line.fromLocationId)
          if (!stockCache.has(fromKey) && !loadingStock.has(fromKey)) {
            fetchCurrentStock(line.productId, line.variantId, line.fromLocationId)
          }
        }
        if (line.toLocationId) {
          const toKey = createStockMapKey(line.productId, line.variantId || null, line.toLocationId)
          if (!stockCache.has(toKey) && !loadingStock.has(toKey)) {
            fetchCurrentStock(line.productId, line.variantId, line.toLocationId)
          }
        }
      }
      
      // For RETURN - fetch stock at destination location (where returning to)
      if (type === MovementType.RETURN && line.toLocationId) {
        const key = createStockMapKey(line.productId, line.variantId || null, line.toLocationId)
        if (!stockCache.has(key) && !loadingStock.has(key)) {
          fetchCurrentStock(line.productId, line.variantId, line.toLocationId)
        }
      }
    }
  }, [type, lines, stockCache, loadingStock, fetchCurrentStock])

  const loadVariantsForProduct = async (productId: string): Promise<Variant[]> => {
    // Check if already loaded (including empty result)
    if (productId in loadedVariants) {
      return loadedVariants[productId]
    }
    
    setLoadingVariantFor(productId)
    try {
      const response = await fetch(`/api/products/${productId}/variants`)
      if (response.ok) {
        const data = await response.json()
        const variants: Variant[] = data.map((v: { 
          id: string
          sku: string
          name: string | null
          costPrice?: number
          optionValues: { optionValue: { value: string; optionType: { name: string } } }[]
          stockBalances?: { qtyOnHand: number }[]
        }) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          options: v.optionValues?.map((ov) => ({
            optionName: ov.optionValue.optionType.name,
            value: ov.optionValue.value,
          })) || [],
          stock: v.stockBalances?.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0) || 0,
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
        }))
        
        // Store in separate loadedVariants state
        setLoadedVariants(prev => ({ ...prev, [productId]: variants }))
        
        return variants
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    } finally {
      setLoadingVariantFor(null)
    }
    return []
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: Math.random().toString(36).substr(2, 9),
        productId: '',
        qty: 1,
        unitCost: 0,
      },
    ])
  }

  // Convert BulkAddVariant to Variant format
  function convertBulkAddVariants(variants: BulkAddVariant[]): Variant[] {
    return variants.map(v => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      options: v.options || [],
      stock: v.stock || 0,
      costPrice: v.costPrice,
    }))
  }

  // Bulk add handler - receives result from modal with selections and loaded variants
  function handleBulkAdd(result: BulkAddResult) {
    const { selections, loadedVariants: modalVariants } = result
    
    const newLines: MovementLine[] = selections.map(sel => ({
      id: Math.random().toString(36).substr(2, 9),
      productId: sel.productId,
      variantId: sel.variantId,
      productName: sel.productName,
      variantLabel: sel.variantLabel,
      qty: 1,
      unitCost: sel.unitCost,
    }))
    
    setLines(prev => [...prev, ...newLines])
    setShowBulkAddModal(false)
    
    // Store loaded variants from modal into page state
    const convertedVariants: Record<string, Variant[]> = {}
    for (const [productId, variants] of Object.entries(modalVariants)) {
      convertedVariants[productId] = convertBulkAddVariants(variants)
    }
    setLoadedVariants(prev => ({ ...prev, ...convertedVariants }))
    
    toast.success(`เพิ่ม ${newLines.length} รายการ`)
  }

  // Load variants for bulk add modal
  const loadVariantsForBulkAdd = async (productId: string): Promise<BulkAddVariant[]> => {
    try {
      const response = await fetch(`/api/products/${productId}/variants`)
      if (response.ok) {
        const variants = await response.json()
        return variants.map((v: { 
          id: string
          sku: string
          name: string | null
          costPrice?: number
          optionValues: { optionValue: { value: string; optionType: { name: string } } }[]
          stockBalances?: { qtyOnHand: number }[]
        }) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          options: v.optionValues?.map((ov) => ({
            optionName: ov.optionValue.optionType.name,
            value: ov.optionValue.value,
          })) || [],
          stock: v.stockBalances?.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0) || 0,
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
        }))
      }
    } catch (error) {
      console.error('Failed to load variants:', error)
    }
    return []
  }

  function removeLine(id: string) {
    setLines(lines.filter((line) => line.id !== id))
  }

  function updateLine(id: string, updates: Partial<MovementLine>) {
    setLines(
      lines.map((line) =>
        line.id === id ? { ...line, ...updates } : line
      )
    )
  }

  async function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const updates: Partial<MovementLine> = {
      productId,
      productName: product.name,
      unitCost: Number(product.lastCost || product.standardCost || 0),
      variantId: undefined,
      variantLabel: undefined,
    }

    updateLine(lineId, updates)

    // Load variants if needed (this updates products state internally)
    if (product.hasVariants) {
      await loadVariantsForProduct(productId)
    }
  }

  async function handleSubmit(e: React.FormEvent, andSubmit = false) {
    e.preventDefault()

    if (lines.length === 0) {
      toast.error('กรุณาเพิ่มรายการสินค้า')
      return
    }

    for (const line of lines) {
      if (!line.productId) {
        toast.error('กรุณาเลือกสินค้าทุกรายการ')
        return
      }
      const product = products.find(p => p.id === line.productId)
      if (product?.hasVariants && !line.variantId) {
        toast.error(`กรุณาเลือก variant สำหรับ ${product.name}`)
        return
      }
      
      // Validate quantity based on type
      if (type === MovementType.ADJUST) {
        // For ADJUST, calculate the actual qty (diff from current stock)
        const currentStock = line.toLocationId 
          ? getStockFromCache(line.productId, line.variantId, line.toLocationId) ?? 0
          : 0
        const newQty = line.newQty ?? currentStock
        const diff = newQty - currentStock
        if (diff === 0) {
          toast.error(`${product?.name || 'สินค้า'}: ไม่มีการเปลี่ยนแปลงยอด`)
          return
        }
      } else if (type === MovementType.RETURN) {
        // For RETURN, qty must be > 0 and <= remainingQty
        if (line.qty <= 0) {
          toast.error('จำนวนคืนต้องมากกว่า 0')
          return
        }
        if (line.remainingQty !== undefined && line.qty > line.remainingQty) {
          toast.error(`${product?.name || 'สินค้า'}: จำนวนคืนเกินจำนวนที่คืนได้ (${line.remainingQty})`)
          return
        }
      } else {
        // For other types, qty must be > 0
        if (line.qty <= 0) {
          toast.error('จำนวนต้องมากกว่า 0')
          return
        }
      }
      
      // Validate TRANSFER has enough stock
      if (type === MovementType.TRANSFER && line.fromLocationId) {
        const fromStock = getStockFromCache(line.productId, line.variantId, line.fromLocationId) ?? 0
        if (line.qty > fromStock) {
          toast.error(`${product?.name || 'สินค้า'}: สต๊อคต้นทางไม่เพียงพอ (มี ${fromStock})`)
          return
        }
      }
    }

    setIsLoading(true)

    // Prepare lines with calculated qty for ADJUST mode
    const processedLines = lines.map((line) => {
      let qty = line.qty
      
      // For ADJUST, calculate the diff from current stock
      if (type === MovementType.ADJUST && line.toLocationId) {
        const currentStock = getStockFromCache(line.productId, line.variantId, line.toLocationId) ?? 0
        const newQty = line.newQty ?? currentStock
        qty = newQty - currentStock
      }
      
      return {
        productId: line.productId,
        variantId: line.variantId,
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        qty,
        unitCost: line.unitCost,
        note: line.note,
        lotId: line.lotId,
        newLotNumber: line.newLotNumber,
        newExpiryDate: line.newExpiryDate,
        orderRef: line.orderRef, // เลขออเดอร์จาก ERP (for ISSUE)
      }
    })

    const result = await createMovement({
      type,
      note,
      reason,
      projectCode,
      refType: refId && type === MovementType.RETURN ? 'MOVEMENT' : undefined,
      refId: refId,
      lines: processedLines,
    })

    if (result.success && andSubmit) {
      await submitMovement(result.data.id)
    }

    setIsLoading(false)

    if (result.success) {
      toast.success(andSubmit ? 'สร้างและส่งเอกสารเรียบร้อยแล้ว' : 'สร้างเอกสารเรียบร้อยแล้ว')
      router.push('/movements')
    } else {
      toast.error(result.error)
    }
  }

  function getProductVariants(productId: string): Variant[] {
    // Check if loaded in loadedVariants state (use 'in' to check for key existence, not value)
    if (productId in loadedVariants) {
      return loadedVariants[productId]
    }
    // Fallback to products state
    const product = products.find(p => p.id === productId)
    return product?.variants || []
  }

  const currentType = typeConfig[type]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/movements">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="สร้างรายการเคลื่อนไหว"
          description="สร้างรายการเบิก/รับ/โอน/ปรับยอดสินค้า"
          icon={<ArrowLeftRight className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Movement Type Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ประเภทการเคลื่อนไหว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(typeConfig).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key as MovementType)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    type === key 
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]' 
                      : 'border-[var(--border-default)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="font-medium text-sm">{config.label}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{config.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reference Document (if return from issue) */}
        {refId && refDocNumber && (
          <Card className="mb-6 bg-[var(--accent-light)]/50 border-[var(--accent-primary)]/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CornerDownRight className="w-5 h-5 text-[var(--accent-primary)]" />
                  <div>
                    <span className="text-sm text-[var(--text-muted)]">คืนจากเอกสาร:</span>
                    <span className="ml-2 font-mono font-medium text-[var(--accent-primary)]">
                      {refDocNumber}
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setRefId(undefined)
                    setRefDocNumber(null)
                    setSelectedIssueId(null)
                    setLines([])
                    setNote('')
                    setReason('')
                  }}
                  className="text-[var(--text-muted)]"
                >
                  เปลี่ยนใบเบิก
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Select Issue Movement for RETURN */}
        {type === MovementType.RETURN && !refId && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
                เลือกใบเบิกที่ต้องการคืน
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingIssues ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
                  <span className="ml-2 text-[var(--text-muted)]">กำลังโหลดรายการเบิก...</span>
                </div>
              ) : issuedMovements.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <FileText className="w-10 h-10 mx-auto opacity-50 mb-2" />
                  <p>ไม่พบรายการเบิกที่ยังมีของให้คืน</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {issuedMovements.map((movement) => {
                    const hasReturnable = movement.lines.some(l => l.remainingQty > 0)
                    if (!hasReturnable) return null
                    
                    return (
                      <div
                        key={movement.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedIssueId === movement.id
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                            : 'border-[var(--border-default)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-secondary)]'
                        }`}
                        onClick={() => handleSelectIssuedMovement(movement.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-[var(--accent-primary)]">
                              {movement.docNumber}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {movement.lines.filter(l => l.remainingQty > 0).length} รายการคืนได้
                            </Badge>
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">
                            {new Date(movement.createdAt).toLocaleDateString('th-TH')}
                          </span>
                        </div>
                        {movement.note && (
                          <p className="text-sm text-[var(--text-muted)] mb-2">{movement.note}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {movement.lines.filter(l => l.remainingQty > 0).slice(0, 3).map((line) => (
                            <Badge key={line.id} variant="outline" className="text-xs">
                              {line.productSku}
                              {line.variantName && ` - ${line.variantName}`}
                              : คืนได้ {line.remainingQty}
                            </Badge>
                          ))}
                          {movement.lines.filter(l => l.remainingQty > 0).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{movement.lines.filter(l => l.remainingQty > 0).length - 3} รายการ
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Movement Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className={currentType.color}>
                {currentType.icon}
                <span className="ml-1">{currentType.label}</span>
              </Badge>
              <CardTitle className="text-base">ข้อมูลเอกสาร</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>เหตุผล</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เหตุผลในการเคลื่อนไหว"
                />
              </div>
              <div className="space-y-2">
                <Label>รหัสโปรเจค / ออเดอร์</Label>
                <Input
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  placeholder="รหัสโปรเจค/ออเดอร์"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-[var(--accent-primary)] rounded-full" />
              <CardTitle className="text-base">รายการสินค้า</CardTitle>
              {lines.length > 0 && (
                <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
                  {lines.length} รายการ
                </Badge>
              )}
              {isScanningBarcode && (
                <Badge variant="secondary" className="bg-[var(--status-info-light)] text-[var(--status-info)] animate-pulse">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  กำลังค้นหา...
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={showBarcodeInput ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowBarcodeInput(!showBarcodeInput)}
              >
                <Scan className="w-4 h-4 mr-1" />
                สแกน Barcode
              </Button>
              <Button
                type="button"
                onClick={() => setShowBulkAddModal(true)}
                size="sm"
                variant="outline"
                disabled={isLoadingProducts}
              >
                <ListPlus className="w-4 h-4 mr-1" />
                เพิ่มหลายรายการ
              </Button>
              <Button
                type="button"
                onClick={addLine}
                size="sm"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มรายการ
              </Button>
            </div>
          </CardHeader>
          
          {/* Barcode Scanner Input */}
          {showBarcodeInput && (
            <CardContent className="pt-0 pb-4 border-b border-[var(--border-default)]">
              <div className="bg-[var(--accent-light)]/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-[var(--accent-primary)]">
                  <Scan className="w-4 h-4" />
                  <span className="font-medium">สแกน Barcode เพื่อเพิ่มสินค้า</span>
                </div>
                <BarcodeInput 
                  onScan={handleBarcodeScan}
                  placeholder="สแกน Barcode หรือ SKU แล้วกด Enter..."
                />
                <p className="text-xs text-[var(--text-muted)]">
                  💡 USB Scanner ทำงานอัตโนมัติ หรือพิมพ์รหัสแล้วกด Enter
                </p>
              </div>
            </CardContent>
          )}
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">สินค้า</TableHead>
                    <TableHead className="min-w-[200px]">ตัวเลือก (สี/ไซส์)</TableHead>
                    <TableHead className="min-w-[150px]">Lot/Batch</TableHead>
                    {(type === 'ISSUE' || type === 'TRANSFER') && (
                      <TableHead className="min-w-[150px]">จากโลเคชัน</TableHead>
                    )}
                    {type === 'TRANSFER' && (
                      <TableHead className="w-24 text-center">สต๊อคต้นทาง</TableHead>
                    )}
                    {(type === 'RECEIVE' || type === 'TRANSFER' || type === 'ADJUST' || type === 'RETURN') && (
                      <TableHead className="min-w-[150px]">
                        {type === 'ADJUST' ? 'โลเคชัน' : 'ไปโลเคชัน'}
                      </TableHead>
                    )}
                    {type === 'ADJUST' && (
                      <TableHead className="w-24 text-center">สต๊อคปัจจุบัน</TableHead>
                    )}
                    {(type === 'TRANSFER' || type === 'RETURN') && (
                      <TableHead className="w-24 text-center">สต๊อคปลายทาง</TableHead>
                    )}
                    {type === 'RETURN' && (
                      <>
                        <TableHead className="w-20 text-center">เบิกไป</TableHead>
                        <TableHead className="w-20 text-center">คืนแล้ว</TableHead>
                        <TableHead className="w-20 text-center">คืนได้</TableHead>
                      </>
                    )}
                    {type === 'ADJUST' ? (
                      <>
                        <TableHead className="w-24 text-center">ยอดใหม่</TableHead>
                        <TableHead className="w-24 text-center">ผลต่าง</TableHead>
                      </>
                    ) : (
                      <TableHead className="w-24">{type === 'RETURN' ? 'คืนครั้งนี้' : 'จำนวน'}</TableHead>
                    )}
                    {type === 'TRANSFER' && (
                      <TableHead className="w-28 text-center">หลังโอน</TableHead>
                    )}
                    {type === 'RETURN' && (
                      <TableHead className="w-28 text-center">หลังคืน</TableHead>
                    )}
                    {type === 'RECEIVE' && (
                      <TableHead className="w-32">ต้นทุน</TableHead>
                    )}
                    {type === 'ISSUE' && (
                      <TableHead className="w-32">เลขออเดอร์</TableHead>
                    )}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                          <Package className="w-10 h-10 opacity-50" />
                          <p>ยังไม่มีรายการ</p>
                          <p className="text-sm">คลิก &quot;เพิ่มรายการ&quot; เพื่อเริ่มต้น</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => {
                      const product = products.find(p => p.id === line.productId)
                      const variants = getProductVariants(line.productId)
                      const showVariantSelect = product?.hasVariants

                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Select
                              value={line.productId}
                              onValueChange={(v) => handleProductChange(line.id, v)}
                              disabled={isLoadingProducts}
                            >
                              <SelectTrigger>
                                {isLoadingProducts ? (
                                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    กำลังโหลด...
                                  </span>
                                ) : (
                                  <SelectValue placeholder="เลือกสินค้า" />
                                )}
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs text-[var(--text-muted)]">{product.sku}</span>
                                      <span>{product.name}</span>
                                      {product.hasVariants && (
                                        <Badge variant="secondary" className="text-xs">Variants</Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {showVariantSelect ? (
                              loadingVariantFor === line.productId ? (
                                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  กำลังโหลดตัวเลือก...
                                </div>
                              ) : variants.length === 0 ? (
                                <div className="text-sm text-[var(--text-muted)]">ไม่พบตัวเลือก</div>
                              ) : (
                                <CascadingVariantPicker
                                  variants={variants}
                                  selectedVariantId={line.variantId}
                                  onSelect={(variant) => {
                                    if (variant) {
                                      updateLine(line.id, {
                                        variantId: variant.id,
                                        variantLabel: variant.options.map(o => o.value).join(' / '),
                                        unitCost: variant.costPrice || line.unitCost,
                                        lotId: undefined,
                                        lotNumber: undefined,
                                      })
                                    } else {
                                      updateLine(line.id, {
                                        variantId: undefined,
                                        variantLabel: undefined,
                                        lotId: undefined,
                                        lotNumber: undefined,
                                      })
                                    }
                                  }}
                                  showStock={true}
                                  placeholder="เลือก สี/ไซส์"
                                />
                              )
                            ) : (
                              <div className="text-[var(--text-muted)] text-sm">-</div>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            {line.productId ? (
                              <LotInput
                                productId={line.productId}
                                variantId={line.variantId}
                                locationId={type === 'ISSUE' || type === 'TRANSFER' ? line.fromLocationId : undefined}
                                mode={type === 'RECEIVE' ? 'receive' : type === 'TRANSFER' ? 'transfer' : 'issue'}
                                selectedLotId={line.lotId}
                                newLotNumber={line.newLotNumber}
                                newExpiryDate={line.newExpiryDate}
                                onSelectExisting={(lot) => {
                                  if (lot) {
                                    updateLine(line.id, {
                                      lotId: lot.id,
                                      lotNumber: lot.lotNumber,
                                      newLotNumber: undefined,
                                      newExpiryDate: undefined,
                                    })
                                  } else {
                                    updateLine(line.id, {
                                      lotId: undefined,
                                      lotNumber: undefined,
                                    })
                                  }
                                }}
                                onCreateNew={(lotNumber, expiryDate) => {
                                  updateLine(line.id, {
                                    lotId: undefined,
                                    lotNumber: undefined,
                                    newLotNumber: lotNumber,
                                    newExpiryDate: expiryDate,
                                  })
                                }}
                                onClear={() => {
                                  updateLine(line.id, {
                                    lotId: undefined,
                                    lotNumber: undefined,
                                    newLotNumber: undefined,
                                    newExpiryDate: undefined,
                                  })
                                }}
                              />
                            ) : (
                              <div className="text-[var(--text-muted)] text-sm">-</div>
                            )}
                          </TableCell>
                          {/* From Location (ISSUE, TRANSFER) */}
                          {(type === 'ISSUE' || type === 'TRANSFER') && (
                            <TableCell>
                              <Select
                                value={line.fromLocationId || ''}
                                onValueChange={(v) => updateLine(line.id, { fromLocationId: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกโลเคชัน" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                      {loc.warehouse.name} - {loc.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          
                          {/* From Stock (TRANSFER only) */}
                          {type === 'TRANSFER' && (
                            <TableCell className="text-center">
                              {line.productId && line.fromLocationId ? (
                                isStockLoading(line.productId, line.variantId, line.fromLocationId) ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-[var(--text-muted)]" />
                                ) : (
                                  <Badge variant="outline" className="bg-[var(--bg-secondary)]">
                                    {getStockFromCache(line.productId, line.variantId, line.fromLocationId)?.toLocaleString() ?? '-'}
                                  </Badge>
                                )
                              ) : (
                                <span className="text-[var(--text-muted)]">-</span>
                              )}
                            </TableCell>
                          )}
                          
                          {/* To Location (RECEIVE, TRANSFER, ADJUST, RETURN) */}
                          {(type === 'RECEIVE' || type === 'TRANSFER' || type === 'ADJUST' || type === 'RETURN') && (
                            <TableCell>
                              <Select
                                value={line.toLocationId || ''}
                                onValueChange={(v) => updateLine(line.id, { toLocationId: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกโลเคชัน" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                      {loc.warehouse.name} - {loc.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          
                          {/* Current Stock at destination (ADJUST, TRANSFER, RETURN) */}
                          {(type === 'ADJUST' || type === 'TRANSFER' || type === 'RETURN') && (
                            <TableCell className="text-center">
                              {line.productId && line.toLocationId ? (
                                isStockLoading(line.productId, line.variantId, line.toLocationId) ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-[var(--text-muted)]" />
                                ) : (
                                  <Badge variant="outline" className="bg-[var(--bg-secondary)]">
                                    {getStockFromCache(line.productId, line.variantId, line.toLocationId)?.toLocaleString() ?? '-'}
                                  </Badge>
                                )
                              ) : (
                                <span className="text-[var(--text-muted)]">-</span>
                              )}
                            </TableCell>
                          )}
                          
                          {/* RETURN mode - Issued/Returned/Remaining columns */}
                          {type === 'RETURN' && (
                            <>
                              <TableCell className="text-center">
                                <span className="font-medium">{line.issuedQty ?? '-'}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-[var(--text-muted)]">{line.returnedQty ?? 0}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={line.remainingQty && line.remainingQty > 0 ? 'bg-[var(--status-success-light)] text-[var(--status-success)]' : ''}>
                                  {line.remainingQty ?? '-'}
                                </Badge>
                              </TableCell>
                            </>
                          )}
                          
                          {/* ADJUST mode - New Qty and Diff */}
                          {type === 'ADJUST' ? (
                            <>
                              <TableCell>
                                {(() => {
                                  const currentStock = line.productId && line.toLocationId 
                                    ? getStockFromCache(line.productId, line.variantId, line.toLocationId) ?? 0
                                    : 0
                                  return (
                                    <Input
                                      type="number"
                                      min="0"
                                      value={line.newQty ?? currentStock}
                                      onChange={(e) => {
                                        const newQty = Number(e.target.value)
                                        const diff = newQty - currentStock
                                        updateLine(line.id, { newQty, qty: diff })
                                      }}
                                      className="w-20"
                                      placeholder="ยอดใหม่"
                                    />
                                  )
                                })()}
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  const currentStock = line.productId && line.toLocationId 
                                    ? getStockFromCache(line.productId, line.variantId, line.toLocationId)
                                    : undefined
                                  if (currentStock === undefined) return <span className="text-[var(--text-muted)]">-</span>
                                  const newQty = line.newQty ?? currentStock
                                  const diff = newQty - currentStock
                                  return (
                                    <div className="flex flex-col items-center">
                                      <Badge 
                                        variant="outline" 
                                        className={
                                          diff > 0 
                                            ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                                            : diff < 0
                                            ? 'bg-[var(--status-error-light)] text-[var(--status-error)]'
                                            : ''
                                        }
                                      >
                                        {diff > 0 ? '+' : ''}{diff}
                                      </Badge>
                                      <span className="text-xs text-[var(--text-muted)] mt-1">
                                        {currentStock} → {newQty}
                                      </span>
                                    </div>
                                  )
                                })()}
                              </TableCell>
                            </>
                          ) : (
                            /* Normal qty input for other types */
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={type === 'RETURN' ? (line.remainingQty ?? undefined) : undefined}
                                value={line.qty}
                                onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) })}
                                className="w-20"
                              />
                            </TableCell>
                          )}
                          
                          {/* After Transfer preview (TRANSFER) */}
                          {type === 'TRANSFER' && (
                            <TableCell className="text-center">
                              {line.productId && line.fromLocationId && line.toLocationId ? (
                                (() => {
                                  const fromStock = getStockFromCache(line.productId, line.variantId, line.fromLocationId)
                                  const toStock = getStockFromCache(line.productId, line.variantId, line.toLocationId)
                                  if (fromStock === undefined || toStock === undefined) {
                                    return <span className="text-[var(--text-muted)]">-</span>
                                  }
                                  const afterFrom = fromStock - line.qty
                                  const afterTo = toStock + line.qty
                                  return (
                                    <div className="flex flex-col text-xs">
                                      <span className={afterFrom < 0 ? 'text-[var(--status-error)]' : ''}>
                                        ต้นทาง: {afterFrom}
                                      </span>
                                      <span className="text-[var(--status-success)]">
                                        ปลายทาง: {afterTo}
                                      </span>
                                    </div>
                                  )
                                })()
                              ) : (
                                <span className="text-[var(--text-muted)]">-</span>
                              )}
                            </TableCell>
                          )}
                          
                          {/* After Return preview (RETURN) */}
                          {type === 'RETURN' && (
                            <TableCell className="text-center">
                              {line.productId && line.toLocationId ? (
                                (() => {
                                  const currentStock = getStockFromCache(line.productId, line.variantId, line.toLocationId)
                                  if (currentStock === undefined) {
                                    return <span className="text-[var(--text-muted)]">-</span>
                                  }
                                  const afterReturn = currentStock + line.qty
                                  return (
                                    <div className="flex flex-col text-xs">
                                      <span className="text-[var(--status-success)]">
                                        {currentStock} → {afterReturn}
                                      </span>
                                    </div>
                                  )
                                })()
                              ) : (
                                <span className="text-[var(--text-muted)]">-</span>
                              )}
                            </TableCell>
                          )}
                          
                          {/* Unit Cost (RECEIVE only) */}
                          {type === 'RECEIVE' && (
                            <TableCell>
                              <div className="flex items-center">
                                <span className="text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] rounded-l px-2 py-1.5 text-sm">฿</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unitCost || ''}
                                  onChange={(e) => updateLine(line.id, { unitCost: Number(e.target.value) })}
                                  className="w-24 rounded-l-none"
                                />
                              </div>
                            </TableCell>
                          )}
                          
                          {/* Order Reference (ISSUE only) */}
                          {type === 'ISSUE' && (
                            <TableCell>
                              <Input
                                type="text"
                                value={line.orderRef || ''}
                                onChange={(e) => updateLine(line.id, { orderRef: e.target.value })}
                                className="w-28"
                                placeholder="เลขออเดอร์"
                              />
                            </TableCell>
                          )}
                          
                          {/* Delete button */}
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(line.id)}
                              className="text-[var(--status-error)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-light)]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href="/movements">ยกเลิก</Link>
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            บันทึกฉบับร่าง
          </Button>
          <Button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            บันทึกและส่ง
          </Button>
        </div>
      </form>

      {/* Bulk Add Modal */}
      <BulkAddModal
        open={showBulkAddModal}
        onOpenChange={setShowBulkAddModal}
        products={products}
        existingProductIds={new Set(lines.filter(l => !l.variantId).map(l => l.productId))}
        existingVariantIds={new Set(lines.filter(l => l.variantId).map(l => l.variantId!))}
        onConfirm={handleBulkAdd}
        loadVariants={loadVariantsForBulkAdd}
        showVariants={true}
      />
    </div>
  )
}
