'use client'

import { useEffect, useState } from 'react'
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
  Copy,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getIntegrations,
  createIntegration,
  deleteIntegration,
  testIntegration,
  type IntegrationConfig,
} from '@/actions/integrations'

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [apiBaseUrl, setApiBaseUrl] = useState('')

  useEffect(() => {
    loadIntegrations()
    setApiBaseUrl(`${window.location.origin}/api/erp`)
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

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`คัดลอก${label}แล้ว`)
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

      {/* ─── API URL Card (Prominent) ───────────────────────── */}
      <Card className="border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-4 h-4 text-[var(--accent-primary)]" />
            Stock API URL สำหรับเชื่อมต่อจากระบบอื่น
          </CardTitle>
          <CardDescription>
            ใช้ URL นี้เป็น &quot;API URL&quot; ในระบบ ERP หรือระบบอื่นที่ต้องการเชื่อมต่อ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-2.5 font-mono text-sm">
              {apiBaseUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => copyToClipboard(apiBaseUrl, ' API URL ')}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* ─── API Documentation Card ────────────────────────── */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plug className="w-5 h-5" />
            ERP API Endpoints
          </CardTitle>
          <CardDescription>
            Endpoints ที่รองรับ — ทุก request ต้องมี header X-API-Key
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">GET</span>
                <code>/api/erp/products</code>
                <span className="text-[var(--text-muted)]">- รายการสินค้าพร้อมสต๊อค</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">GET</span>
                <code>/api/erp/stock</code>
                <span className="text-[var(--text-muted)]">- สต๊อคคงเหลือ</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">GET</span>
                <code>/api/erp/movements</code>
                <span className="text-[var(--text-muted)]">- ประวัติการเคลื่อนไหว</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-[var(--bg-secondary)]">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">POST</span>
                <code>/api/erp/movements</code>
                <span className="text-[var(--text-muted)]">- สร้างรายการเคลื่อนไหว</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddIntegrationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        apiBaseUrl={apiBaseUrl}
        onSuccess={() => {
          loadIntegrations()
          setShowAddDialog(false)
        }}
      />
    </div>
  )
}

// ─── Add Integration Dialog ─────────────────────────────────
function AddIntegrationDialog({
  open,
  onOpenChange,
  apiBaseUrl,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiBaseUrl: string
  onSuccess: () => void
}) {
  const [provider, setProvider] = useState<'peak' | 'custom_erp'>('custom_erp')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Post-creation state: show the generated API key
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [showCreatedKey, setShowCreatedKey] = useState(true)

  function resetForm() {
    setName('')
    setBaseUrl('')
    setClientId('')
    setClientSecret('')
    setCreatedApiKey(null)
    setShowCreatedKey(true)
  }

  async function handleSubmit() {
    if (!name) {
      toast.error('กรุณากรอกชื่อ')
      return
    }

    if (provider === 'peak' && (!baseUrl || !clientId || !clientSecret)) {
      toast.error('กรุณากรอก Base URL, Client ID และ Client Secret')
      return
    }

    setIsSubmitting(true)
    const result = await createIntegration({
      name,
      provider,
      baseUrl: provider === 'custom_erp' ? apiBaseUrl : baseUrl,
      clientId: provider === 'peak' ? clientId : undefined,
      clientSecret: provider === 'peak' ? clientSecret : undefined,
      // API Key is generated server-side for custom_erp
    })

    if (result.success) {
      toast.success('เพิ่มการเชื่อมต่อสำเร็จ')
      if (result.data?.generatedApiKey) {
        // Show the generated key
        setCreatedApiKey(result.data.generatedApiKey)
      } else {
        onSuccess()
        resetForm()
      }
    } else {
      toast.error(result.error || 'ไม่สามารถเพิ่มได้')
    }
    setIsSubmitting(false)
  }

  function handleClose() {
    if (createdApiKey) {
      // User is done viewing the key; close and refresh
      onSuccess()
    }
    resetForm()
    onOpenChange(false)
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`คัดลอก${label}แล้ว`)
  }

  // ─── After creation: show the API key ──────────────────
  if (createdApiKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--status-success)]">
              <ShieldCheck className="w-5 h-5" />
              สร้าง API Key สำเร็จ
            </DialogTitle>
            <DialogDescription>
              คัดลอก API Key และ API URL ด้านล่างไปใส่ในระบบ ERP
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* API URL */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                API URL (วางในช่อง API URL ของ ERP)
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm break-all">
                  {apiBaseUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(apiBaseUrl, ' API URL ')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                API Key (วางในช่อง API Key ของ ERP)
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-[var(--status-success)]/30 bg-[var(--status-success)]/5 px-3 py-2 font-mono text-sm break-all">
                  {showCreatedKey ? createdApiKey : '••••••••••••••••••••••••••••••••••••'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(createdApiKey, ' API Key ')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5 p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--status-warning)]" />
              <div className="text-sm text-[var(--status-warning)]">
                <p className="font-medium">สำคัญ: คัดลอก API Key เก็บไว้ตอนนี้</p>
                <p className="text-xs mt-1 opacity-80">
                  API Key จะแสดงแค่ครั้งนี้เท่านั้น หากปิดหน้าต่างนี้จะไม่สามารถดูได้อีก
                </p>
              </div>
            </div>

            {/* Setup instructions */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4 space-y-2">
              <p className="text-sm font-medium">วิธีตั้งค่าใน Anajak ERP:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--text-muted)]">
                <li>เข้า Anajak ERP &gt; ตั้งค่า &gt; เชื่อมต่อ Stock</li>
                <li>วาง <strong>API URL</strong> ในช่อง &quot;API URL&quot;</li>
                <li>วาง <strong>API Key</strong> ในช่อง &quot;API Key&quot;</li>
                <li>กด &quot;ทดสอบเชื่อมต่อ&quot; แล้วกด &quot;บันทึก&quot;</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose} className="w-full">
              เสร็จสิ้น — ฉันคัดลอกแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ─── Normal form ────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
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
                <SelectItem value="custom_erp">Custom ERP (โรงงาน / Anajak ERP)</SelectItem>
                <SelectItem value="peak">PEAK Account (บัญชี)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ชื่อ</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={provider === 'peak' ? 'บัญชี PEAK' : 'Anajak ERP โรงงาน'}
            />
          </div>

          {provider === 'peak' && (
            <>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.peakaccount.com"
                />
              </div>
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
                  <li>เข้า <a href="https://developers.peakaccount.com" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline">developers.peakaccount.com</a></li>
                  <li>ติดต่อทีม PEAK เพื่อขอ Client ID/Secret</li>
                  <li>ทดสอบใน UAT ก่อนใช้งานจริง</li>
                </ol>
              </div>
            </>
          )}

          {provider === 'custom_erp' && (
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="w-4 h-4 text-[var(--status-success)]" />
                API Key จะถูกสร้างอัตโนมัติ
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                เมื่อกด &quot;เพิ่ม&quot; ระบบจะสร้าง API Key ให้โดยอัตโนมัติ พร้อมแสดงคำแนะนำการตั้งค่าใน ERP
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
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
