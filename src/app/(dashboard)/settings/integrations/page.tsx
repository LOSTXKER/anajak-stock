'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, PageLoading, EmptyState } from '@/components/common'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Link2,
  Plus,
  MoreVertical,
  Plug,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getIntegrations,
  createIntegration,
  deleteIntegration,
  testIntegration,
  getSyncLogs,
  type IntegrationConfig,
} from '@/actions/integrations'

export default function IntegrationsPage() {
  const router = useRouter()
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrations()
  }, [])

  async function loadIntegrations() {
    setIsLoading(true)
    const result = await getIntegrations()
    if (result.success && result.data) {
      setIntegrations(result.data)
    }
    setIsLoading(false)
  }

  async function handleTest(id: string) {
    setTestingId(id)
    const result = await testIntegration(id)
    if (result.success) {
      toast.success(result.data?.message || 'ทดสอบสำเร็จ')
    } else {
      toast.error(result.error || 'ทดสอบไม่สำเร็จ')
    }
    setTestingId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('ต้องการลบการเชื่อมต่อนี้?')) return

    const result = await deleteIntegration(id)
    if (result.success) {
      toast.success('ลบสำเร็จ')
      loadIntegrations()
    } else {
      toast.error(result.error || 'ลบไม่สำเร็จ')
    }
  }

  if (isLoading) {
    return <PageLoading message="กำลังโหลด..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="เชื่อมต่อระบบ"
          description="จัดการการเชื่อมต่อกับระบบบัญชีและ ERP"
          icon={<Link2 className="w-6 h-6 text-[var(--accent-primary)]" />}
        />
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มการเชื่อมต่อ
        </Button>
      </div>

      {integrations.length === 0 ? (
        <EmptyState
          icon={<Link2 className="w-12 h-12" />}
          title="ยังไม่มีการเชื่อมต่อ"
          description="เพิ่มการเชื่อมต่อกับระบบบัญชีหรือ ERP"
          action={
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มการเชื่อมต่อ
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <Card
              key={integration.id}
              className="bg-[var(--bg-elevated)] border-[var(--border-default)]"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        integration.active
                          ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      {integration.provider === 'peak' ? (
                        <span className="text-sm font-bold">PEAK</span>
                      ) : (
                        <Plug className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {integration.provider === 'peak' ? 'PEAK Account' : 'Custom ERP'}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleTest(integration.id)}
                        disabled={testingId === integration.id}
                      >
                        {testingId === integration.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        ทดสอบการเชื่อมต่อ
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="w-4 h-4 mr-2" />
                        ตั้งค่า
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(integration.id)}
                        className="text-[var(--status-danger)]"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        ลบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {integration.active ? (
                      <CheckCircle className="w-4 h-4 text-[var(--status-success)]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--status-danger)]" />
                    )}
                    <span className={integration.active ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}>
                      {integration.active ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] truncate">{integration.baseUrl}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* API Documentation Card */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plug className="w-5 h-5" />
            ERP API สำหรับระบบภายนอก
          </CardTitle>
          <CardDescription>
            ใช้ API นี้เพื่อเชื่อมต่อระบบ ERP โรงงานกับระบบคลังสินค้า
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-sm font-mono mb-2">Base URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-[var(--bg-primary)] rounded text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/erp
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/erp`)
                    toast.success('คัดลอกแล้ว')
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Endpoints ที่รองรับ:</p>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">GET</span>
                  <code>/api/erp/products</code>
                  <span className="text-[var(--text-muted)]">- รายการสินค้าพร้อมสต๊อค</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">GET</span>
                  <code>/api/erp/stock</code>
                  <span className="text-[var(--text-muted)]">- สต๊อคคงเหลือ</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">GET</span>
                  <code>/api/erp/movements</code>
                  <span className="text-[var(--text-muted)]">- ประวัติการเคลื่อนไหว</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">POST</span>
                  <code>/api/erp/movements</code>
                  <span className="text-[var(--text-muted)]">- สร้างรายการเคลื่อนไหว</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5">
              <p className="text-sm text-[var(--status-warning)] font-medium mb-1">⚠️ การยืนยันตัวตน</p>
              <p className="text-sm text-[var(--text-muted)]">
                ทุก request ต้องมี header <code className="bg-[var(--bg-secondary)] px-1 rounded">X-API-Key</code> 
                สร้าง API Key ได้โดยเพิ่มการเชื่อมต่อแบบ "Custom ERP"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddIntegrationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          loadIntegrations()
          setShowAddDialog(false)
        }}
      />
    </div>
  )
}

function AddIntegrationDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [provider, setProvider] = useState<'peak' | 'custom_erp'>('peak')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = 'sk_'
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setApiKey(result)
  }

  async function handleSubmit() {
    if (!name || !baseUrl) {
      toast.error('กรุณากรอกข้อมูลให้ครบ')
      return
    }

    if (provider === 'peak' && (!clientId || !clientSecret)) {
      toast.error('กรุณากรอก Client ID และ Client Secret')
      return
    }

    if (provider === 'custom_erp' && !apiKey) {
      toast.error('กรุณาสร้าง API Key')
      return
    }

    setIsSubmitting(true)
    const result = await createIntegration({
      name,
      provider,
      baseUrl,
      clientId: provider === 'peak' ? clientId : undefined,
      clientSecret: provider === 'peak' ? clientSecret : undefined,
      apiKey: provider === 'custom_erp' ? apiKey : undefined,
    })

    if (result.success) {
      toast.success('เพิ่มการเชื่อมต่อสำเร็จ')
      onSuccess()
      // Reset form
      setName('')
      setBaseUrl('')
      setClientId('')
      setClientSecret('')
      setApiKey('')
    } else {
      toast.error(result.error || 'ไม่สามารถเพิ่มได้')
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มการเชื่อมต่อ</DialogTitle>
          <DialogDescription>
            เชื่อมต่อกับระบบบัญชีหรือ ERP ภายนอก
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>ประเภท</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as 'peak' | 'custom_erp')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="peak">PEAK Account (บัญชี)</SelectItem>
                <SelectItem value="custom_erp">Custom ERP (โรงงาน)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ชื่อ</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={provider === 'peak' ? 'บัญชี PEAK' : 'ERP โรงงาน'}
            />
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider === 'peak' ? 'https://api.peakaccount.com' : 'https://erp.factory.com/api'}
            />
          </div>

          {provider === 'peak' && (
            <>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-sm">
                <p className="font-medium mb-1">วิธีขอ API Key จาก PEAK:</p>
                <ol className="list-decimal list-inside space-y-1 text-[var(--text-muted)]">
                  <li>เข้า <a href="https://developers.peakaccount.com" target="_blank" className="text-[var(--accent-primary)] hover:underline">developers.peakaccount.com</a></li>
                  <li>ติดต่อทีม PEAK เพื่อขอ Client ID/Secret</li>
                  <li>ทดสอบใน UAT ก่อนใช้งานจริง</li>
                </ol>
              </div>
            </>
          )}

          {provider === 'custom_erp' && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_..."
                  readOnly
                />
                <Button type="button" variant="outline" onClick={generateApiKey}>
                  สร้าง
                </Button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                ใช้ API Key นี้ใน header X-API-Key ของทุก request
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            เพิ่ม
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
