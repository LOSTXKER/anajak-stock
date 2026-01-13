'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Settings,
  Users,
  Tag,
  Warehouse,
  ChevronRight,
  Link2,
} from 'lucide-react'

const settingsNavItems = [
  {
    title: 'ผู้ใช้งาน',
    description: 'จัดการผู้ใช้และสิทธิ์',
    icon: Users,
    href: '/settings/users',
  },
  {
    title: 'หมวดหมู่',
    description: 'หมวดหมู่สินค้า',
    icon: Tag,
    href: '/settings/categories',
  },
  {
    title: 'คลังสินค้า',
    description: 'คลังและตำแหน่งจัดเก็บ',
    icon: Warehouse,
    href: '/settings/warehouses',
  },
  {
    title: 'เชื่อมต่อระบบ',
    description: 'PEAK / ERP',
    icon: Link2,
    href: '/settings/integrations',
  },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isSettingsRoot = pathname === '/settings'

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <aside className="w-64 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">ตั้งค่า</h2>
              <p className="text-xs text-[var(--text-muted)]">ระบบและข้อมูลพื้นฐาน</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {settingsNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 shrink-0',
                    isActive ? 'text-[var(--accent-primary)]' : ''
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className={cn(
                    'text-xs truncate',
                    isActive ? 'text-[var(--accent-primary)]/70' : 'text-[var(--text-muted)]'
                  )}>
                    {item.description}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    'w-4 h-4 shrink-0 opacity-0 -translate-x-1 transition-all',
                    isActive && 'opacity-100 translate-x-0',
                    'group-hover:opacity-50 group-hover:translate-x-0'
                  )}
                />
              </Link>
            )
          })}
        </nav>

        {/* Footer Info */}
        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-xs text-[var(--text-muted)]">
            เลือกหมวดหมู่เพื่อจัดการข้อมูล
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {isSettingsRoot ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mb-4">
                <Settings className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                เลือกหมวดหมู่การตั้งค่า
              </h3>
              <p className="text-[var(--text-muted)] max-w-sm">
                เลือกรายการจากเมนูด้านซ้ายเพื่อเริ่มจัดการข้อมูลพื้นฐานและการตั้งค่าระบบ
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  )
}
