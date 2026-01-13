'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Label } from '@/components/ui/label'
import { MoreHorizontal, Shield, UserX, UserCheck, Trash2, Loader2, Key } from 'lucide-react'
import { updateUserRole, toggleUserActive, deleteUser, updateUserPermissions } from '@/actions/users'
import { toast } from 'sonner'
import { Role } from '@/generated/prisma'
import { getPermissionsByGroup, ROLE_PERMISSIONS } from '@/lib/permissions'

interface UserActionsProps {
  user: {
    id: string
    name: string
    role: Role
    customPermissions: string[]
    active: boolean
  }
  currentUserId: string
}

const roleLabels: Record<string, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  APPROVER: 'ผู้อนุมัติ',
  INVENTORY: 'เจ้าหน้าที่คลัง',
  REQUESTER: 'ผู้ขอซื้อ',
  PURCHASING: 'เจ้าหน้าที่จัดซื้อ',
  VIEWER: 'ผู้ดูอย่างเดียว',
}

export function UserActions({ user, currentUserId }: UserActionsProps) {
  const router = useRouter()
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [permDialogOpen, setPermDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role>(user.role)
  const [customPerms, setCustomPerms] = useState<string[]>(user.customPermissions)
  const [isProcessing, setIsProcessing] = useState(false)

  const isCurrentUser = user.id === currentUserId
  const isAdmin = user.role === 'ADMIN'
  const permissionGroups = getPermissionsByGroup()
  const rolePerms = ROLE_PERMISSIONS[user.role] as readonly string[]

  const isFromRole = (key: string) => {
    if (isAdmin) return true
    return rolePerms.includes(key)
  }

  const isPermissionEnabled = (key: string) => {
    if (isAdmin) return true
    return rolePerms.includes(key) || customPerms.includes(key)
  }

  const togglePermission = (key: string) => {
    setCustomPerms(prev => 
      prev.includes(key) 
        ? prev.filter(p => p !== key) 
        : [...prev, key]
    )
  }

  async function handleRoleChange() {
    if (selectedRole === user.role) {
      setRoleDialogOpen(false)
      return
    }

    setIsProcessing(true)
    const result = await updateUserRole(user.id, selectedRole)
    setIsProcessing(false)

    if (result.success) {
      toast.success('เปลี่ยน Role เรียบร้อย')
      setRoleDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handlePermissionsChange() {
    setIsProcessing(true)
    const result = await updateUserPermissions(user.id, customPerms)
    setIsProcessing(false)

    if (result.success) {
      toast.success('บันทึกสิทธิ์เรียบร้อย')
      setPermDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleToggleActive() {
    setIsProcessing(true)
    const result = await toggleUserActive(user.id, !user.active)
    setIsProcessing(false)

    if (result.success) {
      toast.success(user.active ? 'ปิดใช้งานเรียบร้อย' : 'เปิดใช้งานเรียบร้อย')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDelete() {
    setIsProcessing(true)
    const result = await deleteUser(user.id)
    setIsProcessing(false)

    if (result.success) {
      toast.success('ลบผู้ใช้เรียบร้อย')
      setDeleteDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            disabled={isProcessing}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-[var(--text-muted)]">{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setRoleDialogOpen(true)}
            disabled={isCurrentUser}
          >
            <Shield className="w-4 h-4 mr-2" />
            เปลี่ยน Role
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setCustomPerms(user.customPermissions)
              setPermDialogOpen(true)
            }}
            disabled={isCurrentUser || isAdmin}
          >
            <Key className="w-4 h-4 mr-2" />
            จัดการสิทธิ์
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleToggleActive}
            disabled={isCurrentUser}
          >
            {user.active ? (
              <>
                <UserX className="w-4 h-4 mr-2" />
                ปิดใช้งาน
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                เปิดใช้งาน
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            variant="destructive"
            disabled={isCurrentUser}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            ลบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>เปลี่ยน Role</DialogTitle>
            <DialogDescription>
              เลือก Role ใหม่สำหรับ {user.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleRoleChange} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึก'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--accent-primary)]" />
              จัดการสิทธิ์เพิ่มเติม
            </DialogTitle>
            <DialogDescription>
              กำหนดสิทธิ์เพิ่มเติมสำหรับ {user.name} นอกเหนือจาก Role {roleLabels[user.role]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs text-[var(--text-muted)]">
              ✓ สีน้ำเงิน = ได้จาก Role (ไม่สามารถยกเลิกได้) | ☐ ติ๊กเพื่อเพิ่มสิทธิ์
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handlePermissionsChange} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึกสิทธิ์'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบผู้ใช้ <span className="font-medium text-[var(--text-primary)]">{user.name}</span>{' '}
              หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleDelete} disabled={isProcessing} variant="destructive">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
