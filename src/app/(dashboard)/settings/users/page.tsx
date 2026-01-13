import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUsers } from '@/actions/users'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, UserCog } from 'lucide-react'
import { UserActions } from './user-actions'
import { UsersStats } from './users-stats'
import { AddUserDialog } from './add-user-dialog'
import { PageHeader, EmptyState } from '@/components/common'

const roleConfig: Record<string, { label: string; color: string }> = {
  ADMIN: { label: 'ผู้ดูแลระบบ', color: 'bg-[var(--status-error-light)] text-[var(--status-error)]' },
  APPROVER: { label: 'ผู้อนุมัติ', color: 'bg-[var(--accent-light)] text-[var(--accent-primary)]' },
  INVENTORY: { label: 'เจ้าหน้าที่คลัง', color: 'bg-[var(--status-info-light)] text-[var(--status-info)]' },
  REQUESTER: { label: 'ผู้ขอซื้อ', color: 'bg-[var(--status-warning-light)] text-[var(--status-warning)]' },
  VIEWER: { label: 'ผู้ดูอย่างเดียว', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' },
}

async function UsersContent() {
  const session = await getSession()

  if (!session || session.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const users = await getUsers()

  const stats = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === 'ADMIN').length,
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title="จัดการผู้ใช้งาน"
        description="เพิ่ม, เปลี่ยน Role และจัดการสิทธิ์ผู้ใช้"
        icon={<UserCog className="w-6 h-6" />}
        actions={<AddUserDialog />}
      />

      {/* Stats */}
      <UsersStats total={stats.total} active={stats.active} admins={stats.admins} />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--accent-primary)]" />
            รายชื่อผู้ใช้งาน
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {users.length} คน
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>เข้าร่วมเมื่อ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={<Users className="w-8 h-8" />}
                      title="ไม่มีผู้ใช้"
                      description="ยังไม่มีผู้ใช้ในระบบ"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const role = roleConfig[user.role] || roleConfig.VIEWER
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="font-mono text-sm text-[var(--text-muted)]">
                        {user.username}
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)]">{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge className={role.color}>
                          {role.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.active
                              ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                          }
                        >
                          {user.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-muted)] text-sm">
                        {new Date(user.createdAt).toLocaleDateString('th-TH')}
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions
                          user={{
                            id: user.id,
                            name: user.name,
                            role: user.role,
                            customPermissions: user.customPermissions,
                            active: user.active,
                          }}
                          currentUserId={session.id}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  )
}
