'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, UserPlus, Shield } from 'lucide-react'
import { createUser } from '@/actions/users'
import { toast } from 'sonner'
import { Role } from '@/generated/prisma'
import { getPermissionsByGroup, ROLE_PERMISSIONS } from '@/lib/permissions'

const roleLabels: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  APPROVER: 'ผู้อนุมัติ',
  INVENTORY: 'เจ้าหน้าที่คลัง',
  REQUESTER: 'ผู้ขอซื้อ',
  PURCHASING: 'เจ้าหน้าที่จัดซื้อ',
  VIEWER: 'ผู้ดูอย่างเดียว',
}

export function AddUserDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    username: '',
    role: 'VIEWER' as Role,
    customPermissions: [] as string[],
  })

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      username: '',
      role: 'VIEWER',
      customPermissions: [],
    })
    setShowPermissions(false)
  }

  const permissionGroups = getPermissionsByGroup()
  const rolePerms = ROLE_PERMISSIONS[formData.role] as readonly string[]
  const isAdmin = formData.role === 'ADMIN'

  const togglePermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      customPermissions: prev.customPermissions.includes(key)
        ? prev.customPermissions.filter(p => p !== key)
        : [...prev.customPermissions, key]
    }))
  }

  const isPermissionEnabled = (key: string) => {
    if (isAdmin) return true
    return rolePerms.includes(key) || formData.customPermissions.includes(key)
  }

  const isFromRole = (key: string) => {
    if (isAdmin) return true
    return rolePerms.includes(key)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    setIsProcessing(true)
    const result = await createUser(formData)
    setIsProcessing(false)

    if (result.success) {
      toast.success('สร้างผู้ใช้ใหม่เรียบร้อย')
      setOpen(false)
      resetForm()
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetForm()
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มผู้ใช้
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--accent-primary)]" />
            เพิ่มผู้ใช้ใหม่
          </DialogTitle>
          <DialogDescription>
            สร้างบัญชีผู้ใช้ใหม่ในระบบ
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ชื่อที่แสดง"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  placeholder="a-z, 0-9, _"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                minLength={6}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">บทบาท (Role) *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v as Role })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="เลือก Role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Permissions Section */}
            <div className="space-y-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPermissions(!showPermissions)}
                className="w-full justify-start"
              >
                <Shield className="w-4 h-4 mr-2" />
                {showPermissions ? 'ซ่อน' : 'แสดง'} สิทธิ์เพิ่มเติม
              </Button>

              {showPermissions && (
                <div className="border border-[var(--border-default)] rounded-lg p-4 space-y-4 bg-[var(--bg-secondary)]">
                  {isAdmin ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      Admin มีสิทธิ์ทั้งหมดโดยอัตโนมัติ
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-muted)]">
                        ✓ สีน้ำเงิน = ได้จาก Role | ☐ ติ๊กเพิ่มเติมได้
                      </p>
                      {Object.entries(permissionGroups).map(([group, perms]) => (
                        <div key={group} className="space-y-2">
                          <h4 className="text-sm font-medium text-[var(--text-primary)]">{group}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {perms.map((perm) => {
                              const fromRole = isFromRole(perm.key)
                              return (
                                <label
                                  key={perm.key}
                                  className={`flex items-center gap-2 text-sm cursor-pointer ${
                                    fromRole 
                                      ? 'text-[var(--accent-primary)]' 
                                      : 'text-[var(--text-secondary)]'
                                  }`}
                                >
                                  <Checkbox
                                    checked={isPermissionEnabled(perm.key)}
                                    disabled={fromRole}
                                    onCheckedChange={() => togglePermission(perm.key)}
                                  />
                                  {perm.label}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isProcessing}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  สร้างผู้ใช้
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
