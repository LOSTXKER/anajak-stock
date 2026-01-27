'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Bell, 
  MessageSquare, 
  Send, 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Loader2,
  AlertTriangle,
  Package,
  ClipboardCheck,
  Truck,
  Clock,
  TestTube,
  Link as LinkIcon,
  Eye,
  Mail,
  Info,
  Globe,
  User,
  History,
  BarChart3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import {
  getLineSettings,
  updateLineSettings,
  testLineConnection,
  sendLineTextMessage,
  sendLineCustomMessage,
  sendLineLowStockAlert,
  type LineSettings,
} from '@/actions/line-notifications'
import { getEmailStatus } from '@/actions/notifications'
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getNotificationDeliveryLogs,
  getNotificationDeliveryStats,
  type UserNotificationPreferences,
  type NotificationDeliveryLogItem,
  type NotificationChannels,
} from '@/actions/user-notification-preferences'
import {
  getCronSettings,
  updateCronSettings,
  runCronJobManually,
  type CronSettings,
  type CronJobConfig,
} from '@/actions/cron-settings'
import { utcToThaiHour, thaiToUtcHour, formatDays } from '@/lib/cron-utils'
import { formatDateTime } from '@/lib/date'

interface EmailStatus {
  configured: boolean
  fromEmail: string
  message: string
}

interface DeliveryStats {
  total: number
  sent: number
  failed: number
  byChannel: { channel: string; count: number; successRate: number }[]
}

export default function NotificationSettingsPage() {
  // Global LINE settings (Admin only)
  const [lineSettings, setLineSettings] = useState<LineSettings | null>(null)
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null)
  
  // User preferences
  const [userPrefs, setUserPrefs] = useState<UserNotificationPreferences | null>(null)
  
  // Delivery logs
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationDeliveryLogItem[]>([])
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats | null>(null)
  
  // Cron settings
  const [cronSettings, setCronSettings] = useState<CronSettings | null>(null)
  const [runningJob, setRunningJob] = useState<string | null>(null)
  
  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [testMessageOpen, setTestMessageOpen] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [botName, setBotName] = useState('')
  const [activeTab, setActiveTab] = useState('channels')

  useEffect(() => {
    loadAllSettings()
  }, [])

  async function loadAllSettings() {
    setIsLoading(true)
    
    const [lineResult, emailResult, prefsResult, logsResult, statsResult, cronResult] = await Promise.all([
      getLineSettings(),
      getEmailStatus(),
      getUserNotificationPreferences(),
      getNotificationDeliveryLogs(50),
      getNotificationDeliveryStats(),
      getCronSettings(),
    ])
    
    if (lineResult.success && lineResult.data) {
      setLineSettings(lineResult.data)
      if (lineResult.data.channelAccessToken) {
        checkConnection(lineResult.data.channelAccessToken)
      }
    }
    
    if (emailResult.success && emailResult.data) {
      setEmailStatus(emailResult.data)
    }
    
    if (prefsResult.success && prefsResult.data) {
      setUserPrefs(prefsResult.data)
    }
    
    if (logsResult.success && logsResult.data) {
      setDeliveryLogs(logsResult.data)
    }
    
    if (statsResult.success && statsResult.data) {
      setDeliveryStats(statsResult.data)
    }
    
    if (cronResult.success && cronResult.data) {
      setCronSettings(cronResult.data)
    }
    
    setIsLoading(false)
  }

  async function checkConnection(token: string) {
    const result = await testLineConnection(token)
    if (result.success) {
      setConnectionStatus('connected')
      setBotName(result.data.message.replace('เชื่อมต่อสำเร็จ! Bot: ', ''))
    } else {
      setConnectionStatus('error')
    }
  }

  async function handleSaveLineSettings() {
    if (!lineSettings) return

    setIsSaving(true)
    const result = await updateLineSettings(lineSettings)
    setIsSaving(false)

    if (result.success) {
      toast.success('บันทึกการตั้งค่า LINE เรียบร้อย')
      if (lineSettings.channelAccessToken) {
        checkConnection(lineSettings.channelAccessToken)
      }
    } else {
      toast.error(result.error)
    }
  }

  async function handleSaveUserPrefs() {
    if (!userPrefs) return

    setIsSaving(true)
    const result = await updateUserNotificationPreferences(userPrefs)
    setIsSaving(false)

    if (result.success) {
      toast.success('บันทึกการตั้งค่าเรียบร้อย')
    } else {
      toast.error(result.error)
    }
  }

  async function handleTestConnection() {
    if (!lineSettings?.channelAccessToken) {
      toast.error('กรุณากรอก Channel Access Token')
      return
    }

    setIsTesting(true)
    const result = await testLineConnection(lineSettings.channelAccessToken)
    setIsTesting(false)

    if (result.success) {
      toast.success(result.data.message)
      setConnectionStatus('connected')
      setBotName(result.data.message.replace('เชื่อมต่อสำเร็จ! Bot: ', ''))
    } else {
      toast.error(result.error)
      setConnectionStatus('error')
    }
  }

  function addUserId() {
    if (!newUserId.trim() || !lineSettings) return

    if (lineSettings.recipientUserIds.includes(newUserId.trim())) {
      toast.error('User ID นี้มีอยู่แล้ว')
      return
    }

    setLineSettings({
      ...lineSettings,
      recipientUserIds: [...lineSettings.recipientUserIds, newUserId.trim()],
    })
    setNewUserId('')
  }

  function removeUserId(userId: string) {
    if (!lineSettings) return

    setLineSettings({
      ...lineSettings,
      recipientUserIds: lineSettings.recipientUserIds.filter((id) => id !== userId),
    })
  }

  async function handleSendTestMessage() {
    if (!testMessage.trim()) {
      toast.error('กรุณากรอกข้อความ')
      return
    }

    const result = await sendLineTextMessage(testMessage)
    if (result.success) {
      toast.success('ส่งข้อความเรียบร้อย')
      setTestMessageOpen(false)
      setTestMessage('')
    } else {
      toast.error(result.error)
    }
  }

  async function handleTestLowStockAlert() {
    const result = await sendLineLowStockAlert()
    if (result.success) {
      toast.success('ส่งแจ้งเตือนสต๊อคใกล้หมดเรียบร้อย')
    } else {
      toast.error(result.error || 'ไม่มีสินค้าใกล้หมด')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าการแจ้งเตือน"
        description="จัดการช่องทางและประเภทการแจ้งเตือน"
        icon={<Bell className="w-6 h-6" />}
      />

      {/* Quick Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Web */}
        <Card className="border-[var(--status-success)]/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--status-success-light)] flex items-center justify-center">
                <Globe className="w-5 h-5 text-[var(--status-success)]" />
              </div>
              <div className="flex-1">
                <p className="font-medium">เว็บไซต์</p>
                <p className="text-xs text-[var(--text-muted)]">พร้อมใช้งาน</p>
              </div>
              <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                <Check className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* LINE */}
        <Card className={lineSettings?.enabled && connectionStatus === 'connected' 
          ? 'border-[var(--status-success)]/30' 
          : 'border-[var(--status-warning)]/30'
        }>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                lineSettings?.enabled && connectionStatus === 'connected'
                  ? 'bg-[#00B900]'
                  : 'bg-[var(--bg-tertiary)]'
              }`}>
                <MessageSquare className={`w-5 h-5 ${
                  lineSettings?.enabled && connectionStatus === 'connected'
                    ? 'text-white'
                    : 'text-[var(--text-muted)]'
                }`} />
              </div>
              <div className="flex-1">
                <p className="font-medium">LINE</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {botName || 'ไม่ได้เชื่อมต่อ'}
                </p>
              </div>
              {lineSettings?.enabled && connectionStatus === 'connected' ? (
                <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                  <Check className="w-3 h-3 mr-1" />
                  {lineSettings.recipientUserIds.length} ผู้รับ
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <X className="w-3 h-3 mr-1" />
                  ปิด
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email */}
        <Card className={emailStatus?.configured 
          ? 'border-[var(--status-success)]/30' 
          : 'border-[var(--status-warning)]/30'
        }>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                emailStatus?.configured
                  ? 'bg-[var(--status-success-light)]'
                  : 'bg-[var(--bg-tertiary)]'
              }`}>
                <Mail className={`w-5 h-5 ${
                  emailStatus?.configured
                    ? 'text-[var(--status-success)]'
                    : 'text-[var(--text-muted)]'
                }`} />
              </div>
              <div className="flex-1">
                <p className="font-medium">Email</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {emailStatus?.fromEmail || 'ไม่ได้ตั้งค่า'}
                </p>
              </div>
              {emailStatus?.configured ? (
                <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                  <Check className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  ไม่ได้ตั้งค่า
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="channels" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">ช่องทาง</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">ประเภท</span>
          </TabsTrigger>
          <TabsTrigger value="recipients" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">ผู้รับ</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">ตั้งเวลา</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">ประวัติ</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Channels Configuration */}
        <TabsContent value="channels" className="space-y-4 mt-4">
          {/* LINE Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#00B900] rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">LINE Messaging API</CardTitle>
                    <CardDescription>เชื่อมต่อกับ LINE Official Account</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connectionStatus === 'connected' && (
                    <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                      <Check className="w-3 h-3 mr-1" />
                      เชื่อมต่อแล้ว
                    </Badge>
                  )}
                  {connectionStatus === 'error' && (
                    <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)]">
                      <X className="w-3 h-3 mr-1" />
                      เชื่อมต่อไม่สำเร็จ
                    </Badge>
                  )}
                  <Switch
                    checked={lineSettings?.enabled ?? false}
                    onCheckedChange={(enabled) => lineSettings && setLineSettings({ ...lineSettings, enabled })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Access Token</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="ใส่ Channel Access Token"
                      value={lineSettings?.channelAccessToken || ''}
                      onChange={(e) => lineSettings && setLineSettings({ ...lineSettings, channelAccessToken: e.target.value })}
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleTestConnection}
                      disabled={isTesting || !lineSettings?.channelAccessToken}
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Channel Secret (Optional)</Label>
                  <Input
                    type="password"
                    placeholder="ใส่ Channel Secret"
                    value={lineSettings?.channelSecret || ''}
                    onChange={(e) => lineSettings && setLineSettings({ ...lineSettings, channelSecret: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-[var(--accent-primary)]/5 rounded-lg text-sm">
                <Info className="w-4 h-4 text-[var(--accent-primary)] mt-0.5 shrink-0" />
                <div className="text-[var(--text-muted)]">
                  รับ Token ได้จาก{' '}
                  <a 
                    href="https://developers.line.biz/console/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[var(--accent-primary)] hover:underline"
                  >
                    LINE Developers Console
                  </a>
                  {' → Messaging API → Channel Access Token'}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveLineSettings} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  บันทึก
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  emailStatus?.configured 
                    ? 'bg-[var(--status-success-light)]' 
                    : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <Mail className={`w-5 h-5 ${
                    emailStatus?.configured 
                      ? 'text-[var(--status-success)]' 
                      : 'text-[var(--text-muted)]'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-base">Email (Resend)</CardTitle>
                  <CardDescription>
                    {emailStatus?.configured 
                      ? `ส่งจาก ${emailStatus.fromEmail}` 
                      : 'ยังไม่ได้ตั้งค่า'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {!emailStatus?.configured && (
              <CardContent>
                <div className="flex items-start gap-2 p-3 bg-[var(--status-warning-light)]/50 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 text-[var(--status-warning)] mt-0.5 shrink-0" />
                  <div className="text-[var(--text-muted)]">
                    <p className="font-medium text-[var(--status-warning)]">ตั้งค่า Email ใน .env</p>
                    <code className="text-xs block mt-1">RESEND_API_KEY=re_xxxxx</code>
                    <p className="text-xs mt-1">
                      รับ API key ได้จาก{' '}
                      <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
                        resend.com
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Notification Type Preferences */}
        <TabsContent value="preferences" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
                ตั้งค่าการแจ้งเตือนละเอียด
              </CardTitle>
              <CardDescription>
                เลือกช่องทางการแจ้งเตือนสำหรับแต่ละประเภท
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg text-sm">
                <span className="text-[var(--text-muted)]">ช่องทาง:</span>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[var(--status-success)]" />
                  <span>เว็บไซต์</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#00B900]" />
                  <span>LINE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Email</span>
                </div>
              </div>

              {/* Stock Alerts */}
              <NotificationSection
                title="การแจ้งเตือนสต๊อค"
                icon={<Package className="w-4 h-4" />}
                items={[
                  { key: 'lowStock', label: 'สต๊อคใกล้หมด', description: 'แจ้งเตือนเมื่อสินค้าต่ำกว่า Reorder Point', icon: AlertTriangle, color: 'text-[var(--status-warning)]' },
                  { key: 'expiring', label: 'สินค้าใกล้หมดอายุ', description: 'แจ้งเตือนสินค้าที่ใกล้หมดอายุภายใน 30 วัน', icon: Clock, color: 'text-[var(--status-error)]' },
                  { key: 'movementPending', label: 'Movement รออนุมัติ', description: 'แจ้งเตือนเมื่อมีรายการเคลื่อนไหวรออนุมัติ', icon: ClipboardCheck, color: 'text-[var(--accent-primary)]' },
                  { key: 'movementPosted', label: 'Movement Posted', description: 'แจ้งเตือนเมื่อมีการ Post รายการเคลื่อนไหว', icon: Truck, color: 'text-[var(--status-success)]' },
                ]}
                userPrefs={userPrefs}
                onUpdate={(key, channels) => {
                  if (userPrefs) {
                    setUserPrefs({ ...userPrefs, [key]: channels })
                  }
                }}
              />

              {/* PR Alerts */}
              <NotificationSection
                title="ใบขอซื้อ (PR)"
                icon={<FileText className="w-4 h-4" />}
                items={[
                  { key: 'prPending', label: 'PR รออนุมัติ', description: 'แจ้งเตือนเมื่อมี PR ใหม่รออนุมัติ', icon: ClipboardCheck, color: 'text-[var(--accent-primary)]' },
                  { key: 'prApproved', label: 'PR อนุมัติแล้ว', description: 'แจ้งเตือนเมื่อ PR ได้รับการอนุมัติ', icon: CheckCircle2, color: 'text-[var(--status-success)]' },
                  { key: 'prRejected', label: 'PR ไม่อนุมัติ', description: 'แจ้งเตือนเมื่อ PR ถูกปฏิเสธ', icon: XCircle, color: 'text-[var(--status-error)]' },
                ]}
                userPrefs={userPrefs}
                onUpdate={(key, channels) => {
                  if (userPrefs) {
                    setUserPrefs({ ...userPrefs, [key]: channels })
                  }
                }}
              />

              {/* PO Alerts */}
              <NotificationSection
                title="ใบสั่งซื้อ (PO)"
                icon={<ShoppingCart className="w-4 h-4" />}
                items={[
                  { key: 'poPending', label: 'PO รออนุมัติ', description: 'แจ้งเตือนเมื่อมี PO ใหม่รออนุมัติ', icon: ClipboardCheck, color: 'text-[var(--accent-primary)]' },
                  { key: 'poApproved', label: 'PO อนุมัติแล้ว', description: 'แจ้งเตือนเมื่อ PO ได้รับการอนุมัติ', icon: CheckCircle2, color: 'text-[var(--status-success)]' },
                  { key: 'poRejected', label: 'PO ไม่อนุมัติ', description: 'แจ้งเตือนเมื่อ PO ถูกปฏิเสธ', icon: XCircle, color: 'text-[var(--status-error)]' },
                  { key: 'poSent', label: 'ส่งให้ Supplier', description: 'แจ้งเตือนเมื่อส่ง PO ให้ Supplier แล้ว', icon: Send, color: 'text-[var(--status-info)]' },
                  { key: 'poCancelled', label: 'PO ยกเลิก', description: 'แจ้งเตือนเมื่อ PO ถูกยกเลิก', icon: XCircle, color: 'text-[var(--status-error)]' },
                  { key: 'poReceived', label: 'รับสินค้าแล้ว', description: 'แจ้งเตือนเมื่อรับสินค้าตาม PO', icon: Package, color: 'text-[var(--status-info)]' },
                ]}
                userPrefs={userPrefs}
                onUpdate={(key, channels) => {
                  if (userPrefs) {
                    setUserPrefs({ ...userPrefs, [key]: channels })
                  }
                }}
              />

              {/* GRN & Stock Take */}
              <NotificationSection
                title="การรับสินค้า & ตรวจนับ"
                icon={<Truck className="w-4 h-4" />}
                items={[
                  { key: 'grnCreated', label: 'สร้าง GRN', description: 'แจ้งเตือนเมื่อมีการสร้างใบรับสินค้า', icon: Package, color: 'text-[var(--status-info)]' },
                  { key: 'stockTake', label: 'ตรวจนับสต๊อค', description: 'แจ้งเตือนเมื่อมีการตรวจนับสต๊อค', icon: ClipboardCheck, color: 'text-[var(--accent-primary)]' },
                ]}
                userPrefs={userPrefs}
                onUpdate={(key, channels) => {
                  if (userPrefs) {
                    setUserPrefs({ ...userPrefs, [key]: channels })
                  }
                }}
              />

              <div className="flex justify-end pt-4 border-t border-[var(--border-default)]">
                <Button onClick={handleSaveUserPrefs} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  บันทึกการตั้งค่า
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Recipients */}
        <TabsContent value="recipients" className="space-y-4 mt-4">
          {/* My LINE User ID */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--accent-primary)]" />
                LINE User ID ของฉัน
              </CardTitle>
              <CardDescription>
                ใส่ LINE User ID ของคุณเพื่อรับแจ้งเตือนส่วนตัว
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="U1234567890abcdef..."
                  value={userPrefs?.lineUserId || ''}
                  onChange={(e) => userPrefs && setUserPrefs({ ...userPrefs, lineUserId: e.target.value || null })}
                  className="font-mono text-sm"
                />
                <Button onClick={handleSaveUserPrefs} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
              
              <div className="p-3 bg-[var(--accent-primary)]/5 rounded-lg text-sm">
                <p className="font-medium text-[var(--accent-primary)] mb-2">วิธีขอ User ID</p>
                <p className="text-[var(--text-muted)]">
                  เพิ่ม Bot เป็นเพื่อนใน LINE แล้วพิมพ์ <code className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">id</code> เพื่อรับ User ID
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Global Recipients (Admin) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                ผู้รับการแจ้งเตือน (ทั้งระบบ)
              </CardTitle>
              <CardDescription>
                User ID หรือ Group ID ที่จะรับแจ้งเตือนทุกประเภท (สำหรับ Admin)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="U... หรือ C... (Group ID)"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addUserId()}
                  className="font-mono text-sm"
                />
                <Button onClick={addUserId} disabled={!newUserId.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  เพิ่ม
                </Button>
              </div>

              {lineSettings?.recipientUserIds.length === 0 ? (
                <div className="text-center py-6 text-[var(--text-muted)]">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มีผู้รับการแจ้งเตือน</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lineSettings?.recipientUserIds.map((userId, index) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[var(--text-muted)] w-6">#{index + 1}</span>
                        <code className="font-mono text-sm">{userId}</code>
                        <Badge variant="secondary" className="text-xs">
                          {userId.startsWith('U') ? 'User' : userId.startsWith('C') ? 'Group' : 'Other'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--status-error)] hover:bg-[var(--status-error-light)]"
                        onClick={() => removeUserId(userId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveLineSettings} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  บันทึก
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Send */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4 text-[var(--accent-primary)]" />
                ทดสอบส่งข้อความ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Dialog open={testMessageOpen} onOpenChange={setTestMessageOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={!lineSettings?.enabled || lineSettings?.recipientUserIds.length === 0}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      ส่งข้อความ
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>ส่งข้อความทดสอบ</DialogTitle>
                      <DialogDescription>ส่งข้อความ Text ธรรมดา</DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      rows={4}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTestMessageOpen(false)}>ยกเลิก</Button>
                      <Button onClick={handleSendTestMessage}>
                        <Send className="w-4 h-4 mr-2" />
                        ส่ง
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button 
                  variant="outline" 
                  onClick={handleTestLowStockAlert}
                  disabled={!lineSettings?.enabled || lineSettings?.recipientUserIds.length === 0}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  ทดสอบแจ้งเตือนสต๊อคใกล้หมด
                </Button>
              </div>

              {(!lineSettings?.enabled || lineSettings?.recipientUserIds.length === 0) && (
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  * เปิดใช้งาน LINE และเพิ่มผู้รับการแจ้งเตือนก่อนทดสอบ
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Schedule Configuration */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5" />
                ตั้งเวลาแจ้งเตือนอัตโนมัติ
              </CardTitle>
              <CardDescription>
                ระบบจะส่งแจ้งเตือนตามเวลาที่ตั้งไว้ (เวลาประเทศไทย)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {cronSettings && (
                <>
                  {/* Pending Actions Alert */}
                  <CronJobCard
                    config={cronSettings.pendingActionsAlert}
                    onUpdate={(config) => setCronSettings({ ...cronSettings, pendingActionsAlert: config })}
                    onRun={async () => {
                      setRunningJob('pending-actions')
                      const result = await runCronJobManually('pending-actions')
                      setRunningJob(null)
                      if (result.success) {
                        toast.success('ส่งแจ้งเตือนงานค้างเรียบร้อย')
                        loadAllSettings()
                      } else {
                        toast.error(result.error)
                      }
                    }}
                    isRunning={runningJob === 'pending-actions'}
                  />

                  {/* Low Stock Alert */}
                  <CronJobCard
                    config={cronSettings.lowStockAlert}
                    onUpdate={(config) => setCronSettings({ ...cronSettings, lowStockAlert: config })}
                    onRun={async () => {
                      setRunningJob('low-stock')
                      const result = await runCronJobManually('low-stock')
                      setRunningJob(null)
                      if (result.success) {
                        toast.success('ส่งแจ้งเตือนสินค้าใกล้หมดเรียบร้อย')
                        loadAllSettings()
                      } else {
                        toast.error(result.error)
                      }
                    }}
                    isRunning={runningJob === 'low-stock'}
                  />

                  {/* Expiring Stock Alert */}
                  <CronJobCard
                    config={cronSettings.expiringStockAlert}
                    onUpdate={(config) => setCronSettings({ ...cronSettings, expiringStockAlert: config })}
                    onRun={async () => {
                      setRunningJob('expiring-stock')
                      const result = await runCronJobManually('expiring-stock')
                      setRunningJob(null)
                      if (result.success) {
                        toast.success('ส่งแจ้งเตือนสินค้าใกล้หมดอายุเรียบร้อย')
                        loadAllSettings()
                      } else {
                        toast.error(result.error)
                      }
                    }}
                    isRunning={runningJob === 'expiring-stock'}
                  />

                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={async () => {
                        setIsSaving(true)
                        const result = await updateCronSettings(cronSettings)
                        setIsSaving(false)
                        if (result.success) {
                          toast.success('บันทึกการตั้งค่าเรียบร้อย')
                        } else {
                          toast.error(result.error)
                        }
                      }}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      บันทึกการตั้งค่า
                    </Button>
                  </div>
                </>
              )}

              <div className="flex items-start gap-2 p-3 bg-[var(--accent-primary)]/5 rounded-lg text-sm">
                <Info className="w-4 h-4 text-[var(--accent-primary)] mt-0.5 shrink-0" />
                <div className="text-[var(--text-muted)]">
                  <p className="font-medium text-[var(--text-primary)]">หมายเหตุ</p>
                  <p>การตั้งเวลาจะมีผลเมื่อตั้งค่า Vercel Cron Jobs แล้ว ระบบจะส่งแจ้งเตือนอัตโนมัติตามเวลาที่กำหนด</p>
                  <p className="mt-1">สามารถกดปุ่ม "รันทันที" เพื่อทดสอบการส่งแจ้งเตือนได้</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Delivery History */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {/* Stats */}
          {deliveryStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{deliveryStats.total}</div>
                  <p className="text-xs text-[var(--text-muted)]">ทั้งหมด</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-[var(--status-success)]">{deliveryStats.sent}</div>
                  <p className="text-xs text-[var(--text-muted)]">ส่งสำเร็จ</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-[var(--status-error)]">{deliveryStats.failed}</div>
                  <p className="text-xs text-[var(--text-muted)]">ล้มเหลว</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">
                    {deliveryStats.total > 0 
                      ? Math.round(deliveryStats.sent / deliveryStats.total * 100) 
                      : 0}%
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">อัตราสำเร็จ</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--accent-primary)]" />
                  ประวัติการส่ง
                </CardTitle>
                <Button variant="outline" size="sm" onClick={loadAllSettings}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  รีเฟรช
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deliveryLogs.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มีประวัติการส่ง</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เวลา</TableHead>
                        <TableHead>ช่องทาง</TableHead>
                        <TableHead>การแจ้งเตือน</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>ผู้รับ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-[var(--text-muted)]">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {log.channel === 'WEB' && <Globe className="w-3 h-3 mr-1" />}
                              {log.channel === 'LINE' && <MessageSquare className="w-3 h-3 mr-1" />}
                              {log.channel === 'EMAIL' && <Mail className="w-3 h-3 mr-1" />}
                              {log.channel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm truncate max-w-[200px]">
                                {log.notification.title}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {log.notification.type}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.status === 'SENT' && (
                              <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                                <Check className="w-3 h-3 mr-1" />
                                สำเร็จ
                              </Badge>
                            )}
                            {log.status === 'FAILED' && (
                              <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)]">
                                <X className="w-3 h-3 mr-1" />
                                ล้มเหลว
                              </Badge>
                            )}
                            {log.status === 'PENDING' && (
                              <Badge variant="secondary">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                กำลังส่ง
                              </Badge>
                            )}
                            {log.status === 'SKIPPED' && (
                              <Badge variant="secondary">
                                ข้าม
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-[var(--text-muted)] truncate max-w-[150px]">
                            {log.recipientId || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// Notification Section Component
// ============================================

interface NotificationItem {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

interface NotificationSectionProps {
  title: string
  icon: React.ReactNode
  items: NotificationItem[]
  userPrefs: UserNotificationPreferences | null
  onUpdate: (key: string, channels: NotificationChannels) => void
}

function NotificationSection({ title, icon, items, userPrefs, onUpdate }: NotificationSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--bg-secondary)]">
              <TableHead className="w-[45%]">ประเภท</TableHead>
              <TableHead className="text-center w-[18%]">
                <div className="flex items-center justify-center gap-1">
                  <Globe className="w-4 h-4 text-[var(--status-success)]" />
                  <span className="hidden sm:inline">เว็บ</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-[18%]">
                <div className="flex items-center justify-center gap-1">
                  <MessageSquare className="w-4 h-4 text-[#00B900]" />
                  <span className="hidden sm:inline">LINE</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-[18%]">
                <div className="flex items-center justify-center gap-1">
                  <Mail className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span className="hidden sm:inline">Email</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const channels = userPrefs?.[item.key as keyof UserNotificationPreferences] as NotificationChannels | undefined
              const webEnabled = channels?.web ?? true
              const lineEnabled = channels?.line ?? true
              const emailEnabled = channels?.email ?? true

              return (
                <TableRow key={item.key} className="hover:bg-[var(--bg-secondary)]/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-5 h-5 ${item.color} shrink-0`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{item.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={webEnabled}
                        onCheckedChange={(checked) => onUpdate(item.key, { 
                          web: checked, 
                          line: lineEnabled, 
                          email: emailEnabled 
                        })}
                        className="data-[state=checked]:bg-[var(--status-success)]"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={lineEnabled}
                        onCheckedChange={(checked) => onUpdate(item.key, { 
                          web: webEnabled, 
                          line: checked, 
                          email: emailEnabled 
                        })}
                        className="data-[state=checked]:bg-[#00B900]"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={emailEnabled}
                        onCheckedChange={(checked) => onUpdate(item.key, { 
                          web: webEnabled, 
                          line: lineEnabled, 
                          email: checked 
                        })}
                        className="data-[state=checked]:bg-[var(--accent-primary)]"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================
// Cron Job Card Component
// ============================================

interface CronJobCardProps {
  config: CronJobConfig
  onUpdate: (config: CronJobConfig) => void
  onRun: () => void
  isRunning: boolean
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'จ.' },
  { value: 2, label: 'อ.' },
  { value: 3, label: 'พ.' },
  { value: 4, label: 'พฤ.' },
  { value: 5, label: 'ศ.' },
  { value: 6, label: 'ส.' },
  { value: 0, label: 'อา.' },
]

function CronJobCard({ config, onUpdate, onRun, isRunning }: CronJobCardProps) {
  const thaiHour = utcToThaiHour(config.hour)
  
  const toggleDay = (day: number) => {
    const newDays = config.days.includes(day)
      ? config.days.filter(d => d !== day)
      : [...config.days, day].sort()
    onUpdate({ ...config, days: newDays })
  }

  return (
    <div className={`p-4 rounded-lg border ${config.enabled ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => onUpdate({ ...config, enabled })}
            />
            <div>
              <h4 className="font-medium text-[var(--text-primary)]">{config.name}</h4>
              <p className="text-xs text-[var(--text-muted)]">{config.description}</p>
            </div>
          </div>

          {config.enabled && (
            <div className="mt-4 space-y-3">
              {/* Time Setting */}
              <div className="flex items-center gap-4">
                <Label className="text-sm w-16">เวลา</Label>
                <div className="flex items-center gap-2">
                  <select
                    value={thaiHour}
                    onChange={(e) => onUpdate({ ...config, hour: thaiToUtcHour(Number(e.target.value)) })}
                    className="w-20 h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 text-sm"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <span className="text-sm text-[var(--text-muted)]">น.</span>
                </div>
              </div>

              {/* Days Setting */}
              <div className="flex items-center gap-4">
                <Label className="text-sm w-16">วัน</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        config.days.includes(day.value)
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Last Run Info */}
              {config.lastRun && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>รันล่าสุด: {formatDateTime(new Date(config.lastRun))}</span>
                  {config.lastStatus === 'success' && (
                    <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)] text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      สำเร็จ
                    </Badge>
                  )}
                  {config.lastStatus === 'error' && (
                    <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)] text-[10px]">
                      <XCircle className="w-3 h-3 mr-1" />
                      ผิดพลาด
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRun}
          disabled={isRunning || !config.enabled}
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-1" />
              รันทันที
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
