'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Truck,
  ArrowLeft,
  Save,
  Loader2,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock,
  Edit,
  Trash2,
  ShoppingCart,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { getSupplier, updateSupplier, deleteSupplier, toggleSupplierStatus } from '@/actions/suppliers'
import { StatCard } from '@/components/common'

interface SupplierData {
  id: string
  code: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxId: string | null
  terms: string | null
  leadTimeDays: number | null
  active: boolean
  createdAt: Date
  pos: Array<{
    id: string
    docNumber: string
    status: string
    totalAmount: unknown
    createdAt: Date
    _count: { lines: number }
  }>
  _count: { pos: number }
}

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]', label: 'แบบร่าง' },
  PENDING: { color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]', label: 'รออนุมัติ' },
  APPROVED: { color: 'bg-[var(--status-info-light)] text-[var(--status-info)]', label: 'อนุมัติแล้ว' },
  PARTIAL: { color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]', label: 'รับบางส่วน' },
  RECEIVED: { color: 'bg-[var(--status-success-light)] text-[var(--status-success)]', label: 'รับครบ' },
  CANCELLED: { color: 'bg-[var(--status-error-light)] text-[var(--status-error)]', label: 'ยกเลิก' },
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [supplier, setSupplier] = useState<SupplierData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    terms: '',
    leadTimeDays: '',
    active: true,
  })

  const loadData = async () => {
    const result = await getSupplier(id)
    if (result.success) {
      const data = result.data as unknown as SupplierData
      setSupplier(data)
      setFormData({
        code: data.code,
        name: data.name,
        contactName: data.contactName || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        taxId: data.taxId || '',
        terms: data.terms || '',
        leadTimeDays: data.leadTimeDays?.toString() || '',
        active: data.active,
      })
    } else {
      toast.error(result.error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateSupplier(id, {
        ...formData,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
      })

      if (result.success) {
        toast.success('บันทึกสำเร็จ')
        setIsEditing(false)
        loadData()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    const result = await deleteSupplier(id)
    if (result.success) {
      toast.success('ลบ Supplier สำเร็จ')
      router.push('/suppliers')
    } else {
      toast.error(result.error)
    }
    setShowDeleteDialog(false)
  }

  const handleToggleStatus = async () => {
    const result = await toggleSupplierStatus(id)
    if (result.success) {
      toast.success(result.data.active ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว')
      loadData()
    } else {
      toast.error(result.error)
    }
  }

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-[var(--status-error)]">
          ไม่พบ Supplier
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/suppliers">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{supplier.name}</h1>
              <Badge
                className={
                  supplier.active
                    ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                }
              >
                {supplier.active ? 'ใช้งาน' : 'ปิด'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-muted)] mt-1">
              <Truck className="w-4 h-4" />
              รหัส: {supplier.code}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                บันทึก
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                ยกเลิก
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
              <Button
                variant="outline"
                onClick={handleToggleStatus}
                className={supplier.active ? 'text-[var(--status-warning)]' : 'text-[var(--status-success)]'}
              >
                {supplier.active ? (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    ปิดใช้งาน
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    เปิดใช้งาน
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                className="text-[var(--status-error)] border-[var(--status-error)]/50 hover:bg-[var(--status-error-light)]"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบ
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="จำนวน PO ทั้งหมด"
          value={supplier._count.pos}
          icon={ShoppingCart}
          variant="info"
        />
        <StatCard
          title="Lead Time"
          value={supplier.leadTimeDays ? `${supplier.leadTimeDays} วัน` : '-'}
          icon={Clock}
          variant="default"
        />
        <StatCard
          title="เงื่อนไขชำระ"
          value={supplier.terms || '-'}
          icon={FileCheck}
          variant="default"
        />
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
            ข้อมูลพื้นฐาน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">รหัส Supplier</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">ชื่อบริษัท/ร้าน</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => updateField('taxId', e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-[var(--text-muted)]">รหัส</div>
                <div className="font-mono font-medium">{supplier.code}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-muted)]">ชื่อ</div>
                <div className="font-medium">{supplier.name}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-muted)]">เลขภาษี</div>
                <div className="font-mono">{supplier.taxId || '-'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--accent-primary)]" />
            ข้อมูลติดต่อ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="contactName">ชื่อผู้ติดต่อ</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => updateField('contactName', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">ที่อยู่</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{supplier.contactName || '-'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{supplier.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{supplier.email || '-'}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                <span>{supplier.address || '-'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms & Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
            เงื่อนไขและการตั้งค่า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leadTimeDays">Lead Time (วัน)</Label>
                  <Input
                    id="leadTimeDays"
                    type="number"
                    min="0"
                    value={formData.leadTimeDays}
                    onChange={(e) => updateField('leadTimeDays', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terms">เงื่อนไขการชำระเงิน</Label>
                  <Input
                    id="terms"
                    value={formData.terms}
                    onChange={(e) => updateField('terms', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg">
                <div>
                  <Label htmlFor="active" className="font-medium">สถานะการใช้งาน</Label>
                  <p className="text-sm text-[var(--text-muted)]">เปิดใช้งาน Supplier นี้</p>
                </div>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => updateField('active', checked)}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-[var(--text-muted)]">Lead Time</div>
                <div className="font-medium">{supplier.leadTimeDays ? `${supplier.leadTimeDays} วัน` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-muted)]">เงื่อนไขชำระ</div>
                <div className="font-medium">{supplier.terms || '-'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent POs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[var(--accent-primary)]" />
            ใบสั่งซื้อล่าสุด
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {supplier._count.pos} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplier.pos.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              ยังไม่มีใบสั่งซื้อ
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จำนวนรายการ</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.pos.map((po) => {
                  const status = statusConfig[po.status] || statusConfig.DRAFT
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-sm text-[var(--accent-primary)]">
                        {po.docNumber}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {po._count.lines}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(po.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">
                        {new Date(po.createdAt).toLocaleDateString('th-TH')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/po/${po.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--status-error)]">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการลบ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบ Supplier "{supplier.name}" ใช่หรือไม่?
              {supplier._count.pos > 0 && (
                <span className="block mt-2 text-[var(--status-warning)]">
                  Supplier นี้มี {supplier._count.pos} PO จะถูกซ่อนแทนที่จะลบถาวร
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
