'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowLeftRight,
  Menu,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Role } from '@/generated/prisma'
import { hasPermission } from '@/lib/permissions'

interface BottomNavProps {
  userRole: Role
  customPermissions?: string[]
  className?: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission: string | null
  match?: (pathname: string) => boolean
}

const mainNavItems: NavItem[] = [
  {
    title: 'หน้าหลัก',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: null,
    match: (pathname) => pathname === '/dashboard',
  },
  {
    title: 'สินค้า',
    href: '/products',
    icon: Package,
    permission: 'products:read',
    match: (pathname) => pathname.startsWith('/products'),
  },
  {
    title: 'คลัง',
    href: '/stock',
    icon: Warehouse,
    permission: 'stock:read',
    match: (pathname) => pathname.startsWith('/stock'),
  },
  {
    title: 'เคลื่อนไหว',
    href: '/movements',
    icon: ArrowLeftRight,
    permission: 'movements:read',
    match: (pathname) => pathname.startsWith('/movements'),
  },
]

export function BottomNav({ userRole, customPermissions = [], className }: BottomNavProps) {
  const pathname = usePathname()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const canAccess = (permission: string | null) => {
    if (!permission) return true
    return hasPermission(userRole, permission, customPermissions)
  }

  const isActive = (item: NavItem) => {
    if (item.match) {
      return item.match(pathname)
    }
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const accessibleMainItems = mainNavItems.filter(item => canAccess(item.permission))

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-elevated)] border-t border-[var(--border-default)] md:hidden safe-bottom',
        className
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {accessibleMainItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-colors',
                active
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5',
                  active && 'text-[var(--accent-primary)]'
                )}
              />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          )
        })}

        {/* More Menu */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-1 py-2 rounded-lg transition-colors',
                isMoreOpen
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">เพิ่มเติม</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader>
              <SheetTitle>เมนูทั้งหมด</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-1">
              {/* Scan */}
              {canAccess('stock:read') && (
                <Link
                  href="/scan"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/scan')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>สแกน Barcode</span>
                </Link>
              )}

              {/* Lots */}
              {canAccess('stock:read') && (
                <Link
                  href="/lots"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/lots')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>Lot / Batch</span>
                </Link>
              )}

              {/* Stock Take */}
              {canAccess('stock:write') && (
                <Link
                  href="/stock-take"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/stock-take')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>ตรวจนับสต๊อค</span>
                </Link>
              )}

              {/* Suppliers */}
              {canAccess('suppliers:read') && (
                <Link
                  href="/suppliers"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/suppliers')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>ซัพพลายเออร์</span>
                </Link>
              )}

              {/* Purchasing */}
              {canAccess('pr:read') && (
                <Link
                  href="/purchasing"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/purchasing') || 
                    pathname.startsWith('/pr') || 
                    pathname.startsWith('/po') || 
                    pathname.startsWith('/grn')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>เอกสารจัดซื้อ</span>
                </Link>
              )}

              {/* Reports */}
              {canAccess('reports:read') && (
                <Link
                  href="/reports/analytics"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/reports')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>รายงาน</span>
                </Link>
              )}

              {/* Settings */}
              {userRole === 'ADMIN' && (
                <Link
                  href="/settings"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname.startsWith('/settings')
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span>ตั้งค่าระบบ</span>
                </Link>
              )}

              {/* Help */}
              <Link
                href="/help"
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  pathname.startsWith('/help')
                    ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                    : 'hover:bg-[var(--bg-hover)]'
                )}
              >
                <Package className="w-5 h-5" />
                <span>คู่มือการใช้งาน</span>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
