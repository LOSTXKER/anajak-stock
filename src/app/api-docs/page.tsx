'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  Package,
  Warehouse,
  ArrowLeftRight,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface QueryParam {
  name: string
  type: string
  required: boolean
  description: string
  example?: string
}

interface BodyField {
  name: string
  type: string
  required: boolean
  description: string
  children?: BodyField[]
}

interface Endpoint {
  method: HttpMethod
  path: string
  title: string
  description: string
  queryParams?: QueryParam[]
  bodyFields?: BodyField[]
  requestExample?: string
  responseExample: string
}

interface EndpointGroup {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  endpoints: Endpoint[]
}

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const endpointGroups: EndpointGroup[] = [
  {
    id: 'products',
    title: 'สินค้า (Products)',
    description: 'ดึงรายการสินค้าพร้อมข้อมูลสต๊อคและตัวเลือก',
    icon: <Package className="w-5 h-5" />,
    endpoints: [
      {
        method: 'GET',
        path: '/api/erp/products',
        title: 'ดึงรายการสินค้า',
        description: 'ดึงรายการสินค้าทั้งหมด พร้อมสต๊อคตามโลเคชัน และ Variants (ถ้ามี) รองรับ pagination, ค้นหา, กรองตามหมวดหมู่',
        queryParams: [
          { name: 'page', type: 'number', required: false, description: 'หน้าที่ต้องการ', example: '1' },
          { name: 'limit', type: 'number', required: false, description: 'จำนวนต่อหน้า (default: 100)', example: '50' },
          { name: 'search', type: 'string', required: false, description: 'ค้นหาจาก SKU, ชื่อ, barcode', example: 'T-001' },
          { name: 'category', type: 'string', required: false, description: 'กรองตามชื่อหมวดหมู่', example: 'เสื้อยืด' },
          { name: 'itemType', type: 'string', required: false, description: 'กรองตามประเภทสินค้า: FINISHED_GOOD, RAW_MATERIAL, PACKAGING', example: 'FINISHED_GOOD' },
          { name: 'updated_after', type: 'ISO 8601', required: false, description: 'เฉพาะสินค้าที่อัปเดตหลังวันที่กำหนด (สำหรับ sync)', example: '2026-01-01T00:00:00Z' },
        ],
        responseExample: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'clx...',
                sku: 'TS-001',
                name: 'เสื้อยืดคอกลม',
                description: 'เสื้อยืดคอกลม Cotton 100%',
                barcode: '8851234567890',
                category: 'เสื้อยืด',
                unit: 'PCS',
                unitName: 'ตัว',
                standardCost: 120,
                lastCost: 115,
                reorderPoint: 50,
                hasVariants: true,
                itemType: 'FINISHED_GOOD',
                totalStock: 350,
                stockByLocation: [
                  { locationCode: 'WH-01', locationName: 'คลังหลัก', qty: 200 },
                  { locationCode: 'WH-02', locationName: 'คลังสำรอง', qty: 150 },
                ],
                variants: [
                  {
                    id: 'clv...',
                    sku: 'TS-001-RD-M',
                    barcode: '8851234567891',
                    name: 'แดง / M',
                    costPrice: 115,
                    sellingPrice: 250,
                    totalStock: 120,
                    stockByLocation: [
                      { locationCode: 'WH-01', locationName: 'คลังหลัก', qty: 80 },
                      { locationCode: 'WH-02', locationName: 'คลังสำรอง', qty: 40 },
                    ],
                    options: [
                      { type: 'สี', value: 'แดง' },
                      { type: 'ไซส์', value: 'M' },
                    ],
                  },
                ],
                updatedAt: '2026-03-25T10:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 100, total: 42, totalPages: 1 },
          },
        }, null, 2),
      },
      {
        method: 'DELETE',
        path: '/api/erp/products/{id}',
        title: 'ลบสินค้า (Soft Delete)',
        description: 'Soft delete สินค้า — ตั้ง active=false แต่ยังคงข้อมูลอยู่ในระบบ',
        responseExample: JSON.stringify({
          success: true,
          data: { id: 'clx...', sku: 'TS-001', deletedAt: '2026-03-25T12:00:00.000Z' },
        }, null, 2),
      },
    ],
  },
  {
    id: 'stock',
    title: 'สต๊อค (Stock)',
    description: 'ดึงข้อมูลสต๊อคคงเหลือ แยกตามโลเคชัน/คลัง พร้อมแจ้งสินค้าใกล้หมด',
    icon: <Warehouse className="w-5 h-5" />,
    endpoints: [
      {
        method: 'GET',
        path: '/api/erp/stock',
        title: 'ดึงสต๊อคคงเหลือ',
        description: 'ดึงยอดสต๊อคคงเหลือทั้งหมด สามารถกรองตามโลเคชัน คลังสินค้า หรือแสดงเฉพาะสินค้าใกล้หมด',
        queryParams: [
          { name: 'page', type: 'number', required: false, description: 'หน้าที่ต้องการ', example: '1' },
          { name: 'limit', type: 'number', required: false, description: 'จำนวนต่อหน้า (default: 100)', example: '50' },
          { name: 'location', type: 'string', required: false, description: 'กรองตามรหัสโลเคชัน', example: 'WH-01' },
          { name: 'warehouse', type: 'string', required: false, description: 'กรองตามรหัสคลัง', example: 'MAIN' },
          { name: 'low_stock', type: 'boolean', required: false, description: 'แสดงเฉพาะสินค้าใกล้หมด (qty <= reorderPoint)', example: 'true' },
        ],
        responseExample: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                productId: 'clx...',
                productSku: 'TS-001',
                productName: 'เสื้อยืดคอกลม',
                productBarcode: '8851234567890',
                variantId: 'clv...',
                variantSku: 'TS-001-RD-M',
                variantName: 'แดง / M',
                locationCode: 'WH-01',
                locationName: 'คลังหลัก',
                warehouseCode: 'MAIN',
                warehouseName: 'คลังสินค้าหลัก',
                qty: 80,
                reorderPoint: 50,
                minQty: 10,
                maxQty: 500,
                isLowStock: false,
              },
            ],
            summary: {
              totalItems: 156,
              lowStockCount: 12,
              totalQty: 8450,
            },
            pagination: { page: 1, limit: 100, total: 156, totalPages: 2 },
          },
        }, null, 2),
      },
    ],
  },
  {
    id: 'movements',
    title: 'เคลื่อนไหวสต๊อค (Movements)',
    description: 'ดึงประวัติและสร้างรายการเคลื่อนไหวสต๊อค (รับ-เบิก-โอน-ปรับ)',
    icon: <ArrowLeftRight className="w-5 h-5" />,
    endpoints: [
      {
        method: 'GET',
        path: '/api/erp/movements',
        title: 'ดึงประวัติเคลื่อนไหว',
        description: 'ดึงรายการเคลื่อนไหวสต๊อค สามารถกรองตามประเภท สถานะ และช่วงเวลา',
        queryParams: [
          { name: 'page', type: 'number', required: false, description: 'หน้าที่ต้องการ', example: '1' },
          { name: 'limit', type: 'number', required: false, description: 'จำนวนต่อหน้า (default: 50)', example: '20' },
          { name: 'type', type: 'string', required: false, description: 'ประเภท: RECEIVE, ISSUE, TRANSFER, ADJUST', example: 'RECEIVE' },
          { name: 'status', type: 'string', required: false, description: 'สถานะ: DRAFT, POSTED, CANCELLED', example: 'POSTED' },
          { name: 'from_date', type: 'ISO 8601', required: false, description: 'วันเริ่มต้น', example: '2026-03-01T00:00:00Z' },
          { name: 'to_date', type: 'ISO 8601', required: false, description: 'วันสิ้นสุด', example: '2026-03-31T23:59:59Z' },
        ],
        responseExample: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'clm...',
                docNumber: 'ERP-000001',
                type: 'RECEIVE',
                status: 'POSTED',
                refType: 'ERP',
                refId: 'PO-2026-001',
                note: 'รับสินค้าจากโรงงาน',
                reason: null,
                createdBy: 'ERP System',
                createdAt: '2026-03-25T08:00:00.000Z',
                postedAt: '2026-03-25T08:00:00.000Z',
                lines: [
                  {
                    productSku: 'TS-001',
                    productName: 'เสื้อยืดคอกลม',
                    variantSku: 'TS-001-RD-M',
                    variantName: 'แดง / M',
                    fromLocation: null,
                    toLocation: 'WH-01',
                    qty: 100,
                    unitCost: 115,
                  },
                ],
              },
            ],
            pagination: { page: 1, limit: 50, total: 234, totalPages: 5 },
          },
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/api/erp/movements',
        title: 'สร้างรายการเคลื่อนไหว',
        description: 'สร้างรายการเคลื่อนไหวสต๊อคใหม่ — รับเข้า (RECEIVE), เบิกออก (ISSUE), โอนย้าย (TRANSFER), ปรับยอด (ADJUST) ระบบจะอัปเดตยอดสต๊อคอัตโนมัติ',
        bodyFields: [
          { name: 'type', type: 'string', required: true, description: 'ประเภท: RECEIVE, ISSUE, TRANSFER, ADJUST' },
          { name: 'refNo', type: 'string', required: false, description: 'เลขอ้างอิงจากระบบภายนอก เช่น PO number' },
          { name: 'note', type: 'string', required: false, description: 'หมายเหตุ' },
          { name: 'reason', type: 'string', required: false, description: 'เหตุผล (สำหรับ ADJUST)' },
          {
            name: 'lines', type: 'array', required: true, description: 'รายการสินค้า (ต้องมีอย่างน้อย 1 รายการ)',
            children: [
              { name: 'sku', type: 'string', required: true, description: 'SKU ของสินค้า' },
              { name: 'fromLocation', type: 'string', required: false, description: 'รหัสโลเคชันต้นทาง (จำเป็นสำหรับ ISSUE, TRANSFER)' },
              { name: 'toLocation', type: 'string', required: false, description: 'รหัสโลเคชันปลายทาง (จำเป็นสำหรับ RECEIVE, TRANSFER)' },
              { name: 'qty', type: 'number', required: true, description: 'จำนวน' },
              { name: 'unitCost', type: 'number', required: false, description: 'ต้นทุนต่อหน่วย' },
              { name: 'note', type: 'string', required: false, description: 'หมายเหตุรายบรรทัด' },
            ],
          },
        ],
        requestExample: JSON.stringify({
          type: 'RECEIVE',
          refNo: 'PO-2026-001',
          note: 'รับสินค้าจากโรงงาน Lot 3/2026',
          lines: [
            { sku: 'TS-001-RD-M', toLocation: 'WH-01', qty: 100, unitCost: 115 },
            { sku: 'TS-001-BL-L', toLocation: 'WH-01', qty: 80, unitCost: 115 },
          ],
        }, null, 2),
        responseExample: JSON.stringify({
          success: true,
          data: {
            id: 'clm...',
            docNumber: 'ERP-000042',
            type: 'RECEIVE',
            status: 'POSTED',
            linesCount: 2,
            createdAt: '2026-03-25T10:30:00.000Z',
          },
        }, null, 2),
      },
    ],
  },
]

export default function PublicApiDocsPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())

  useEffect(() => {
    setApiBaseUrl(window.location.origin)
  }, [])

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAll = () => {
    const all = new Set<string>()
    endpointGroups.forEach((g) =>
      g.endpoints.forEach((_, i) => all.add(`${g.id}-${i}`))
    )
    setExpandedEndpoints(all)
  }

  const collapseAll = () => setExpandedEndpoints(new Set())

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-primary)]/80">
        <div className="max-w-5xl mx-auto flex items-center gap-4 px-4 sm:px-6 h-16">
          <Link href="/login" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-[var(--text-primary)] text-sm leading-tight">Stock Management</h1>
              <p className="text-[11px] text-[var(--text-muted)]">API Documentation</p>
            </div>
          </div>
          <span className="ml-auto text-xs font-mono px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-default)]">
            v1.0.0
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-[var(--accent-primary)]" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">API Documentation</h1>
          </div>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            เอกสาร API สำหรับเชื่อมต่อจากเว็บไซต์หรือระบบภายนอก เพื่อดึงข้อมูลสินค้า สต๊อค และสร้างรายการเคลื่อนไหว
          </p>
        </div>

        {/* Quick Start */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <QuickInfoCard
            icon={<Shield className="w-5 h-5 text-[var(--accent-primary)]" />}
            title="Authentication"
            description="ทุก request ต้องส่ง API Key ผ่าน header"
          >
            <code className="text-xs font-mono block mt-2 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]">
              X-API-Key: your_api_key_here
            </code>
          </QuickInfoCard>
          <QuickInfoCard
            icon={<Zap className="w-5 h-5 text-amber-500" />}
            title="Base URL"
            description="ใช้ URL นี้เป็น prefix ของทุก endpoint"
          >
            <CopyableCode text={apiBaseUrl || 'https://your-domain.com'} className="mt-2" />
          </QuickInfoCard>
          <QuickInfoCard
            icon={<ExternalLink className="w-5 h-5 text-emerald-500" />}
            title="Rate Limit"
            description="จำกัดจำนวน request ต่อ API Key"
          >
            <p className="text-xs text-[var(--text-muted)] mt-2">
              หาก request เกินกำหนด จะได้ status <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">429 Too Many Requests</code>
            </p>
          </QuickInfoCard>
        </div>

        {/* Auth details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">วิธีเริ่มต้นใช้งาน</CardTitle>
            <CardDescription>
              ขอ API Key จากผู้ดูแลระบบ (สร้างได้ในหน้า ตั้งค่า &gt; เชื่อมต่อระบบ &gt; เพิ่มการเชื่อมต่อ ประเภท Custom ERP)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="js">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent value="curl" className="mt-3">
                <CodeBlock
                  code={`curl -X GET "${apiBaseUrl || 'https://your-domain.com'}/api/erp/products" \\\n  -H "X-API-Key: your_api_key_here"`}
                  lang="bash"
                />
              </TabsContent>
              <TabsContent value="js" className="mt-3">
                <CodeBlock
                  code={`const res = await fetch("${apiBaseUrl || 'https://your-domain.com'}/api/erp/products", {\n  headers: {\n    "X-API-Key": "your_api_key_here",\n  },\n});\nconst data = await res.json();\nconsole.log(data);`}
                  lang="javascript"
                />
              </TabsContent>
              <TabsContent value="python" className="mt-3">
                <CodeBlock
                  code={`import requests\n\nres = requests.get(\n    "${apiBaseUrl || 'https://your-domain.com'}/api/erp/products",\n    headers={"X-API-Key": "your_api_key_here"},\n)\ndata = res.json()\nprint(data)`}
                  lang="python"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Error Responses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Error Responses</CardTitle>
            <CardDescription>รูปแบบ error response ที่อาจเกิดขึ้น</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ErrorCard status={401} message="Invalid or missing API key" description="ไม่ได้ส่ง API Key หรือ Key ไม่ถูกต้อง" />
              <ErrorCard status={429} message="Too many requests" description="Request เกินจำนวนที่กำหนด" />
              <ErrorCard status={404} message="Product not found: TS-999" description="ไม่พบสินค้าหรือทรัพยากรที่ระบุ" />
              <ErrorCard status={400} message="Lines are required" description="ข้อมูลที่ส่งมาไม่ถูกต้อง" />
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Endpoints</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              เปิดทั้งหมด
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              ปิดทั้งหมด
            </Button>
          </div>
        </div>

        {endpointGroups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {group.icon}
                {group.title}
              </CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.endpoints.map((endpoint, idx) => {
                const key = `${group.id}-${idx}`
                const isExpanded = expandedEndpoints.has(key)
                return (
                  <EndpointCard
                    key={key}
                    endpoint={endpoint}
                    baseUrl={apiBaseUrl}
                    isExpanded={isExpanded}
                    onToggle={() => toggleEndpoint(key)}
                  />
                )
              })}
            </CardContent>
          </Card>
        ))}

        {/* Webhook */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Webhook Receiver
            </CardTitle>
            <CardDescription>
              POST /api/erp — รับ action จากระบบภายนอก (sync_product, sync_stock, create_movement)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="sync_product">
              <TabsList className="flex-wrap">
                <TabsTrigger value="sync_product">sync_product</TabsTrigger>
                <TabsTrigger value="sync_stock">sync_stock</TabsTrigger>
                <TabsTrigger value="create_movement">create_movement</TabsTrigger>
              </TabsList>
              <TabsContent value="sync_product" className="mt-3">
                <CodeBlock
                  code={JSON.stringify({ action: 'sync_product', sku: 'TS-NEW-001', name: 'เสื้อยืดรุ่นใหม่', description: 'Cotton 100% Premium', cost: 130 }, null, 2)}
                  lang="json"
                />
              </TabsContent>
              <TabsContent value="sync_stock" className="mt-3">
                <CodeBlock
                  code={JSON.stringify({ action: 'sync_stock', sku: 'TS-001', locationCode: 'WH-01', qty: 500 }, null, 2)}
                  lang="json"
                />
              </TabsContent>
              <TabsContent value="create_movement" className="mt-3">
                <CodeBlock
                  code={JSON.stringify({ action: 'create_movement', type: 'RECEIVE', refNo: 'ERP-PO-001', note: 'รับสินค้าจากโรงงาน', lines: [{ sku: 'TS-001', locationCode: 'WH-01', qty: 100, unitCost: 115 }] }, null, 2)}
                  lang="json"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          Stock Management API v1.0.0
        </div>
      </main>
    </div>
  )
}

/* ────────────────────── Sub-components ────────────────────── */

function QuickInfoCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">{icon}</div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[var(--text-primary)]">{title}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CopyableCode({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('คัดลอกแล้ว')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <code className="flex-1 text-xs font-mono p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] truncate">{text}</code>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success('คัดลอกแล้ว')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group">
      <pre className="text-xs font-mono p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-elevated)] border border-[var(--border-default)]"
        onClick={copy}
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </Button>
      <span className="absolute bottom-2 right-2 text-[10px] text-[var(--text-muted)] uppercase opacity-50">{lang}</span>
    </div>
  )
}

function ErrorCard({ status, message, description }: { status: number; message: string; description: string }) {
  const bg = status >= 500 ? 'border-red-200 dark:border-red-900/50' : status >= 400 ? 'border-amber-200 dark:border-amber-900/50' : ''
  return (
    <div className={cn('rounded-lg border p-3 text-sm', bg)}>
      <div className="flex items-center gap-2 mb-1">
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-[var(--bg-secondary)]">{status}</span>
        <code className="text-xs">{message}</code>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  )
}

function EndpointCard({ endpoint, baseUrl, isExpanded, onToggle }: { endpoint: Endpoint; baseUrl: string; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)]/50 transition-colors">
        {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
        <span className={cn('px-2 py-0.5 rounded text-xs font-bold shrink-0', METHOD_STYLES[endpoint.method])}>{endpoint.method}</span>
        <code className="text-sm font-mono text-[var(--text-primary)]">{endpoint.path}</code>
        <span className="text-sm text-[var(--text-muted)] ml-auto hidden sm:inline">{endpoint.title}</span>
      </button>
      {isExpanded && (
        <div className="border-t border-[var(--border-default)] p-4 space-y-4 bg-[var(--bg-secondary)]/30">
          <p className="text-sm text-[var(--text-secondary)]">{endpoint.description}</p>
          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Query Parameters</h4>
              <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[var(--bg-secondary)]"><th className="text-left p-2 font-medium">Parameter</th><th className="text-left p-2 font-medium">Type</th><th className="text-left p-2 font-medium hidden sm:table-cell">Required</th><th className="text-left p-2 font-medium">Description</th></tr></thead>
                  <tbody>
                    {endpoint.queryParams.map((p) => (
                      <tr key={p.name} className="border-t border-[var(--border-default)]">
                        <td className="p-2"><code className="text-[var(--accent-primary)]">{p.name}</code></td>
                        <td className="p-2 text-[var(--text-muted)]">{p.type}</td>
                        <td className="p-2 hidden sm:table-cell">{p.required ? <span className="text-red-500 font-medium">required</span> : <span className="text-[var(--text-muted)]">optional</span>}</td>
                        <td className="p-2 text-[var(--text-secondary)]">{p.description}{p.example && <span className="ml-1 text-[var(--text-muted)]">(เช่น <code>{p.example}</code>)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {endpoint.bodyFields && endpoint.bodyFields.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Request Body (JSON)</h4>
              <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[var(--bg-secondary)]"><th className="text-left p-2 font-medium">Field</th><th className="text-left p-2 font-medium">Type</th><th className="text-left p-2 font-medium hidden sm:table-cell">Required</th><th className="text-left p-2 font-medium">Description</th></tr></thead>
                  <tbody>{endpoint.bodyFields.map((f) => <BodyFieldRow key={f.name} field={f} depth={0} />)}</tbody>
                </table>
              </div>
            </div>
          )}
          {endpoint.requestExample && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Request Example</h4>
              <CodeBlock code={endpoint.requestExample} lang="json" />
            </div>
          )}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Response Example</h4>
            <CodeBlock code={endpoint.responseExample} lang="json" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">cURL</h4>
            <CodeBlock code={buildCurlExample(endpoint, baseUrl)} lang="bash" />
          </div>
        </div>
      )}
    </div>
  )
}

function BodyFieldRow({ field, depth }: { field: BodyField; depth: number }) {
  return (
    <>
      <tr className="border-t border-[var(--border-default)]">
        <td className="p-2" style={{ paddingLeft: `${8 + depth * 16}px` }}>
          {depth > 0 && <span className="text-[var(--text-muted)] mr-1">└</span>}
          <code className="text-[var(--accent-primary)]">{field.name}</code>
        </td>
        <td className="p-2 text-[var(--text-muted)]">{field.type}</td>
        <td className="p-2 hidden sm:table-cell">{field.required ? <span className="text-red-500 font-medium">required</span> : <span className="text-[var(--text-muted)]">optional</span>}</td>
        <td className="p-2 text-[var(--text-secondary)]">{field.description}</td>
      </tr>
      {field.children?.map((child) => <BodyFieldRow key={child.name} field={child} depth={depth + 1} />)}
    </>
  )
}

function buildCurlExample(endpoint: Endpoint, baseUrl: string): string {
  const url = `${baseUrl || 'https://your-domain.com'}${endpoint.path}`
  if (endpoint.method === 'GET') {
    const paramStr = endpoint.queryParams?.filter((p) => p.example).map((p) => `${p.name}=${p.example}`).join('&')
    const fullUrl = paramStr ? `${url}?${paramStr}` : url
    return `curl -X GET "${fullUrl}" \\\n  -H "X-API-Key: your_api_key_here"`
  }
  if (endpoint.method === 'POST') {
    return `curl -X POST "${url}" \\\n  -H "X-API-Key: your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.requestExample || '{}'}'`
  }
  return `curl -X ${endpoint.method} "${url}" \\\n  -H "X-API-Key: your_api_key_here"`
}
