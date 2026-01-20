'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

interface EmailStatus {
  configured: boolean
  fromEmail: string
  message: string
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<LineSettings | null>(null)
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [testMessageOpen, setTestMessageOpen] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [customCardOpen, setCustomCardOpen] = useState(false)
  const [customCard, setCustomCard] = useState({
    title: '',
    message: '',
    buttonLabel: '',
    buttonUrl: '',
  })
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [botName, setBotName] = useState('')

  useEffect(() => {
    loadSettings()
    loadEmailStatus()
  }, [])

  async function loadSettings() {
    setIsLoading(true)
    const result = await getLineSettings()
    if (result.success && result.data) {
      setSettings(result.data)
      if (result.data.channelAccessToken) {
        checkConnection(result.data.channelAccessToken)
      }
    }
    setIsLoading(false)
  }

  async function loadEmailStatus() {
    const result = await getEmailStatus()
    if (result.success && result.data) {
      setEmailStatus(result.data)
    }
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

  async function handleSave() {
    if (!settings) return

    setIsSaving(true)
    const result = await updateLineSettings(settings)
    setIsSaving(false)

    if (result.success) {
      toast.success('บันทึกการตั้งค่าเรียบร้อย')
      if (settings.channelAccessToken) {
        checkConnection(settings.channelAccessToken)
      }
    } else {
      toast.error(result.error)
    }
  }

  async function handleTestConnection() {
    if (!settings?.channelAccessToken) {
      toast.error('กรุณากรอก Channel Access Token')
      return
    }

    setIsTesting(true)
    const result = await testLineConnection(settings.channelAccessToken)
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
    if (!newUserId.trim()) return
    if (!settings) return

    if (settings.recipientUserIds.includes(newUserId.trim())) {
      toast.error('User ID นี้มีอยู่แล้ว')
      return
    }

    setSettings({
      ...settings,
      recipientUserIds: [...settings.recipientUserIds, newUserId.trim()],
    })
    setNewUserId('')
  }

  function removeUserId(userId: string) {
    if (!settings) return

    setSettings({
      ...settings,
      recipientUserIds: settings.recipientUserIds.filter((id) => id !== userId),
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

  async function handleSendCustomCard() {
    if (!customCard.title.trim() || !customCard.message.trim()) {
      toast.error('กรุณากรอกหัวข้อและข้อความ')
      return
    }

    const result = await sendLineCustomMessage(
      customCard.title,
      customCard.message,
      customCard.buttonLabel || undefined,
      customCard.buttonUrl || undefined
    )

    if (result.success) {
      toast.success('ส่ง Card เรียบร้อย')
      setCustomCardOpen(false)
      setCustomCard({ title: '', message: '', buttonLabel: '', buttonUrl: '' })
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

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-muted)]">ไม่สามารถโหลดการตั้งค่าได้</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าการแจ้งเตือน"
        description="จัดการการแจ้งเตือนผ่าน Email และ LINE Messaging API"
        icon={<Bell className="w-6 h-6" />}
      />

      {/* Notification Channels Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email Status */}
        <Card className={emailStatus?.configured ? 'border-[var(--status-success)]/30' : 'border-[var(--status-warning)]/30'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  emailStatus?.configured 
                    ? 'bg-[var(--status-success-light)]' 
                    : 'bg-[var(--status-warning-light)]'
                }`}>
                  <Mail className={`w-5 h-5 ${
                    emailStatus?.configured 
                      ? 'text-[var(--status-success)]' 
                      : 'text-[var(--status-warning)]'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-base">Email (Resend)</CardTitle>
                  <CardDescription className="text-xs">
                    {emailStatus?.fromEmail || 'ไม่ได้ตั้งค่า'}
                  </CardDescription>
                </div>
              </div>
              {emailStatus?.configured ? (
                <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                  <Check className="w-3 h-3 mr-1" />
                  พร้อมใช้งาน
                </Badge>
              ) : (
                <Badge className="bg-[var(--status-warning-light)] text-[var(--status-warning)]">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  ไม่ได้ตั้งค่า
                </Badge>
              )}
            </div>
          </CardHeader>
          {!emailStatus?.configured && (
            <CardContent className="pt-0">
              <div className="flex items-start gap-2 p-3 bg-[var(--status-warning-light)]/50 rounded-lg text-sm">
                <Info className="w-4 h-4 text-[var(--status-warning)] mt-0.5 shrink-0" />
                <div className="text-[var(--text-muted)]">
                  <p className="font-medium text-[var(--status-warning)]">ตั้งค่า Email ใน .env</p>
                  <code className="text-xs">RESEND_API_KEY=re_xxxxx</code>
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

        {/* LINE Status Summary */}
        <Card className={settings?.enabled && connectionStatus === 'connected' ? 'border-[var(--status-success)]/30' : 'border-[var(--border-default)]'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  settings?.enabled && connectionStatus === 'connected'
                    ? 'bg-[#00B900]' 
                    : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <MessageSquare className={`w-5 h-5 ${
                    settings?.enabled && connectionStatus === 'connected'
                      ? 'text-white' 
                      : 'text-[var(--text-muted)]'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-base">LINE Messaging</CardTitle>
                  <CardDescription className="text-xs">
                    {botName || 'ไม่ได้เชื่อมต่อ'}
                  </CardDescription>
                </div>
              </div>
              {settings?.enabled && connectionStatus === 'connected' ? (
                <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)]">
                  <Check className="w-3 h-3 mr-1" />
                  {settings.recipientUserIds.length} ผู้รับ
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <X className="w-3 h-3 mr-1" />
                  ไม่ได้เปิดใช้
                </Badge>
              )}
            </div>
          </CardHeader>
          {(!settings?.enabled || connectionStatus !== 'connected') && (
            <CardContent className="pt-0">
              <p className="text-xs text-[var(--text-muted)]">
                ตั้งค่า Channel Access Token ด้านล่าง
              </p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* LINE Connection Status */}
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
                  {botName && `: ${botName}`}
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)]">
                  <X className="w-3 h-3 mr-1" />
                  เชื่อมต่อไม่สำเร็จ
                </Badge>
              )}
              <Switch
                checked={settings.enabled}
                onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Channel Access Token</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ใส่ Channel Access Token จาก LINE Developers Console"
                value={settings.channelAccessToken}
                onChange={(e) => setSettings({ ...settings, channelAccessToken: e.target.value })}
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={isTesting || !settings.channelAccessToken}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
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
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recipient User IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-[var(--accent-primary)]" />
            ผู้รับการแจ้งเตือน
          </CardTitle>
          <CardDescription>
            เพิ่ม LINE User ID หรือ Group ID ของผู้ที่ต้องการรับแจ้งเตือน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* How to get User ID */}
          <div className="p-4 bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20 rounded-lg space-y-3">
            <p className="font-medium text-[var(--accent-primary)] flex items-center gap-2">
              <Info className="w-4 h-4" />
              วิธีขอ User ID / Group ID
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
                <p className="font-medium mb-1">👤 User ID</p>
                <p className="text-xs text-[var(--text-muted)]">
                  เพิ่ม Bot เป็นเพื่อนใน LINE แล้ว Bot จะตอบกลับ User ID ให้อัตโนมัติ
                </p>
              </div>
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
                <p className="font-medium mb-1">👥 Group ID</p>
                <p className="text-xs text-[var(--text-muted)]">
                  เชิญ Bot เข้ากลุ่ม LINE แล้ว Bot จะส่ง Group ID ให้ในกลุ่มทันที
                </p>
              </div>
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
                <p className="font-medium mb-1">💬 พิมพ์ขอ</p>
                <p className="text-xs text-[var(--text-muted)]">
                  พิมพ์ <code className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--accent-primary)]">id</code> ในแชทกับ Bot หรือในกลุ่ม
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="U1234567890abcdef... หรือ C1234567890abcdef..."
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

          {settings.recipientUserIds.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>ยังไม่มีผู้รับการแจ้งเตือน</p>
              <p className="text-xs mt-1">เพิ่ม LINE User ID หรือ Group ID เพื่อรับแจ้งเตือน</p>
            </div>
          ) : (
            <div className="space-y-2">
              {settings.recipientUserIds.map((userId, index) => (
                <div
                  key={userId}
                  className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--text-muted)]">#{index + 1}</span>
                    <code className="font-mono text-sm">{userId}</code>
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
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-[var(--accent-primary)]" />
            ประเภทการแจ้งเตือน
          </CardTitle>
          <CardDescription>เลือกการแจ้งเตือนที่ต้องการรับผ่าน LINE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { 
              key: 'notifyLowStock', 
              label: 'สต๊อคใกล้หมด', 
              description: 'แจ้งเตือนเมื่อสินค้าต่ำกว่า Reorder Point',
              icon: AlertTriangle,
              color: 'text-[var(--status-warning)]',
            },
            { 
              key: 'notifyPRPending', 
              label: 'PR รออนุมัติ', 
              description: 'แจ้งเตือนเมื่อมีใบขอซื้อใหม่รออนุมัติ',
              icon: ClipboardCheck,
              color: 'text-[var(--accent-primary)]',
            },
            { 
              key: 'notifyPOStatus', 
              label: 'อัพเดท PO', 
              description: 'แจ้งเตือนเมื่อ PO มีการเปลี่ยนสถานะ',
              icon: Package,
              color: 'text-[var(--status-info)]',
            },
            { 
              key: 'notifyMovementPosted', 
              label: 'Movement Posted', 
              description: 'แจ้งเตือนเมื่อมีการ Post รายการเคลื่อนไหว',
              icon: Truck,
              color: 'text-[var(--status-success)]',
            },
            { 
              key: 'notifyExpiring', 
              label: 'สินค้าใกล้หมดอายุ', 
              description: 'แจ้งเตือนสินค้าที่ใกล้หมดอายุภายใน 30 วัน',
              icon: Clock,
              color: 'text-[var(--status-error)]',
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
                </div>
              </div>
              <Switch
                checked={settings[item.key as keyof LineSettings] as boolean}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Test Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-[var(--accent-primary)]" />
            ทดสอบส่งข้อความ
          </CardTitle>
          <CardDescription>ทดสอบการส่งข้อความไปยังผู้รับที่ตั้งค่าไว้</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* Test Text Message */}
            <Dialog open={testMessageOpen} onOpenChange={setTestMessageOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!settings.enabled || settings.recipientUserIds.length === 0}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  ส่งข้อความ
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>ส่งข้อความทดสอบ</DialogTitle>
                  <DialogDescription>ส่งข้อความ Text ธรรมดา</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTestMessageOpen(false)}>
                    ยกเลิก
                  </Button>
                  <Button onClick={handleSendTestMessage}>
                    <Send className="w-4 h-4 mr-2" />
                    ส่ง
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Test Flex Card */}
            <Dialog open={customCardOpen} onOpenChange={setCustomCardOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!settings.enabled || settings.recipientUserIds.length === 0}>
                  <Eye className="w-4 h-4 mr-2" />
                  ส่ง Card
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>ส่ง Flex Card</DialogTitle>
                  <DialogDescription>ส่งการ์ดพร้อมปุ่ม Action</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>หัวข้อ *</Label>
                    <Input
                      placeholder="หัวข้อ Card"
                      value={customCard.title}
                      onChange={(e) => setCustomCard({ ...customCard, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ข้อความ *</Label>
                    <Textarea
                      placeholder="เนื้อหาข้อความ"
                      value={customCard.message}
                      onChange={(e) => setCustomCard({ ...customCard, message: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ชื่อปุ่ม (ถ้ามี)</Label>
                      <Input
                        placeholder="ดูรายละเอียด"
                        value={customCard.buttonLabel}
                        onChange={(e) => setCustomCard({ ...customCard, buttonLabel: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL ปุ่ม</Label>
                      <Input
                        placeholder="https://..."
                        value={customCard.buttonUrl}
                        onChange={(e) => setCustomCard({ ...customCard, buttonUrl: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCustomCardOpen(false)}>
                    ยกเลิก
                  </Button>
                  <Button onClick={handleSendCustomCard}>
                    <Send className="w-4 h-4 mr-2" />
                    ส่ง Card
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Test Low Stock Alert */}
            <Button 
              variant="outline" 
              onClick={handleTestLowStockAlert}
              disabled={!settings.enabled || settings.recipientUserIds.length === 0}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              ทดสอบแจ้งเตือนสต๊อคใกล้หมด
            </Button>
          </div>

          {(!settings.enabled || settings.recipientUserIds.length === 0) && (
            <p className="text-xs text-[var(--text-muted)] mt-3">
              * เปิดใช้งาน LINE และเพิ่มผู้รับการแจ้งเตือนก่อนทดสอบ
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={loadSettings}>
          ยกเลิก
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          บันทึก
        </Button>
      </div>
    </div>
  )
}
