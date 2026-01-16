'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { LogOut, User, Search } from 'lucide-react'
import { Role } from '@/generated/prisma'
import { ThemeToggle } from '@/components/common'
import { NotificationBell } from '@/components/notification-bell'

interface HeaderProps {
  user: {
    name: string
    email: string
    role: Role
  }
}

const roleLabels: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  INVENTORY: 'คลังสินค้า',
  REQUESTER: 'ผู้ขอเบิก',
  APPROVER: 'ผู้อนุมัติ',
  PURCHASING: 'ฝ่ายจัดซื้อ',
  VIEWER: 'ผู้ดูรายงาน',
}

const roleColors: Record<Role, string> = {
  ADMIN: 'bg-[var(--accent-primary)]',
  INVENTORY: 'bg-[var(--status-success)]',
  REQUESTER: 'bg-[var(--status-info)]',
  APPROVER: 'bg-[var(--status-warning)]',
  PURCHASING: 'bg-[var(--accent-primary)]',
  VIEWER: 'bg-gray-500',
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="h-14 md:h-16 bg-[var(--bg-primary)] border-b border-[var(--border-default)] flex items-center justify-between px-3 md:px-6">
      {/* Left side - Search (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            type="search"
            placeholder="ค้นหา..."
            className="pl-9 bg-[var(--bg-secondary)] border-[var(--border-default)] focus:border-[var(--accent-primary)] h-9"
          />
        </div>
      </div>

      {/* Mobile: Logo/Title */}
      <div className="flex md:hidden items-center gap-2">
        <h1 className="text-base font-bold text-[var(--text-primary)]">Stock</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationBell />

        {/* Separator (hidden on mobile) */}
        <div className="hidden md:block h-8 w-px bg-[var(--border-default)] mx-1" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 md:gap-3 hover:bg-[var(--bg-hover)] pl-1.5 md:pl-2 pr-2 md:pr-3 h-9"
            >
              <Avatar className="w-7 h-7">
                <AvatarFallback
                  className={`${roleColors[user.role]} text-white text-xs font-medium`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                  {user.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                  {roleLabels[user.role]}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-[var(--text-primary)]">{user.name}</span>
                <span className="text-xs font-normal text-[var(--text-muted)]">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              โปรไฟล์
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-[var(--status-error)] focus:text-[var(--status-error)] cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
