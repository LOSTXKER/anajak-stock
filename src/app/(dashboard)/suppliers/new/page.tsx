'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Truck, ArrowLeft, Save, Loader2, Building2, User, Phone, Mail, MapPin, FileText, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { createSupplier } from '@/actions/suppliers'
import { PageHeader } from '@/components/common'

export default function NewSupplierPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await createSupplier({
        ...formData,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
      })

      if (result.success) {
        toast.success('สร้าง Supplier สำเร็จ')
        router.push(`/suppliers/${result.data.id}`)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsLoading(false)
    }
  }

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/suppliers">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="เพิ่ม Supplier ใหม่"
          description="กรอกข้อมูลผู้ขายเพื่อเริ่มสั่งซื้อสินค้า"
          icon={<Truck className="w-6 h-6" />}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              ข้อมูลพื้นฐาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">
                  รหัส Supplier <span className="text-[var(--status-error)]">*</span>
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  placeholder="SUP001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">
                  ชื่อบริษัท/ร้าน <span className="text-[var(--status-error)]">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="บริษัท ABC จำกัด"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) => updateField('taxId', e.target.value)}
                placeholder="0123456789012"
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="contactName">ชื่อผู้ติดต่อ</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => updateField('contactName', e.target.value)}
                placeholder="คุณสมชาย"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  เบอร์โทรศัพท์
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="081-234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  อีเมล
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="contact@supplier.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                ที่อยู่
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110"
                rows={3}
              />
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leadTimeDays" className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Lead Time (วัน)
                </Label>
                <Input
                  id="leadTimeDays"
                  type="number"
                  min="0"
                  value={formData.leadTimeDays}
                  onChange={(e) => updateField('leadTimeDays', e.target.value)}
                  placeholder="7"
                />
                <p className="text-xs text-[var(--text-muted)]">ระยะเวลาส่งสินค้าโดยเฉลี่ย</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">เงื่อนไขการชำระเงิน</Label>
                <Input
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => updateField('terms', e.target.value)}
                  placeholder="เครดิต 30 วัน"
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            บันทึก
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/suppliers">ยกเลิก</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
