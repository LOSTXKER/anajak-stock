'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowLeftRight,
  ClipboardCheck,
  BarChart3,
  Settings,
  Truck,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  AlertTriangle,
  TrendingUp,
  Clock,
  Archive,
  Calendar,
  FileStack,
  Scan,
} from 'lucide-react'
import { Role } from '@/generated/prisma'
import { hasPermission } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  userRole: Role
  customPermissions?: string[]
}

interface MenuItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission: string | null
  adminOnly?: boolean
}

interface MenuGroup {
  title: string
  icon: React.ComponentType<{ className?: string }>
  permission: string | null
  adminOnly?: boolean
  items: MenuItem[]
}

// Dashboard - standalone
const dashboardItem: MenuItem = {
  title: 'แดชบอร์ด',
  href: '/dashboard',
  icon: LayoutDashboard,
  permission: null,
}

// Stock & Products section
const stockMenuItems: MenuItem[] = [
  {
    title: 'สแกน Barcode',
    href: '/scan',
    icon: Scan,
    permission: 'stock:read',
  },
  {
    title: 'สินค้า',
    href: '/products',
    icon: Package,
    permission: 'products:read',
  },
  {
    title: 'คลังสินค้า',
    href: '/stock',
    icon: Warehouse,
    permission: 'stock:read',
  },
  {
    title: 'เคลื่อนไหวสต๊อค',
    href: '/movements',
    icon: ArrowLeftRight,
    permission: 'movements:read',
  },
  {
    title: 'ตรวจนับสต๊อค',
    href: '/stock-take',
    icon: ClipboardCheck,
    permission: 'stock:write',
  },
]

// Purchasing section
const purchasingMenuItems: MenuItem[] = [
  {
    title: 'ซัพพลายเออร์',
    href: '/suppliers',
    icon: Truck,
    permission: 'suppliers:read',
  },
  {
    title: 'เอกสารจัดซื้อ',
    href: '/purchasing',
    icon: FileStack,
    permission: 'pr:read',
  },
]

// Reports group with sub-items (removed สต๊อคคงเหลือ - duplicate of คลังสินค้า)
const reportsGroup: MenuGroup = {
  title: 'รายงาน',
  icon: BarChart3,
  permission: 'reports:read',
  items: [
    { title: 'วิเคราะห์เชิงลึก', href: '/reports/analytics', icon: BarChart3, permission: 'reports:read' },
    { title: 'สินค้าใกล้หมด', href: '/reports/low-stock', icon: AlertTriangle, permission: 'reports:read' },
    { title: 'Dead Stock', href: '/reports/dead-stock', icon: Archive, permission: 'reports:read' },
    { title: 'สินค้าใกล้หมดอายุ', href: '/reports/expiring', icon: Clock, permission: 'reports:read' },
    { title: 'Top สินค้าเบิกออก', href: '/reports/top-issue', icon: TrendingUp, permission: 'reports:read' },
    { title: 'ประสิทธิภาพ Supplier', href: '/reports/supplier-lead-time', icon: Truck, permission: 'reports:read' },
    { title: 'รอบเวลา PR → PO', href: '/reports/cycle-time', icon: Calendar, permission: 'reports:read' },
    { title: 'พยากรณ์การใช้', href: '/reports/forecast', icon: TrendingUp, permission: 'reports:read' },
    { title: 'Movement Ledger', href: '/reports/ledger', icon: ArrowLeftRight, permission: 'reports:read' },
  ],
}

// Settings - single link (has its own sidebar)
const settingsMenuItem: MenuItem = {
  title: 'ตั้งค่าระบบ',
  href: '/settings',
  icon: Settings,
  permission: null,
  adminOnly: true,
}

export function Sidebar({ userRole, customPermissions = [] }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Auto-expand group if current path is in it
  useEffect(() => {
    const newExpanded = new Set<string>()
    
    if (reportsGroup.items.some(item => pathname.startsWith(item.href))) {
      newExpanded.add('reports')
    }
    
    if (newExpanded.size > 0) {
      setExpandedGroups(prev => new Set([...prev, ...newExpanded]))
    }
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    // Special handling for purchasing page (matches /pr, /po, /grn, /purchasing)
    // Use exact match or path with trailing slash to avoid matching /products with /pr
    if (href === '/purchasing') {
      return pathname === '/purchasing' || 
             pathname === '/pr' || pathname.startsWith('/pr/') || 
             pathname === '/po' || pathname.startsWith('/po/') || 
             pathname === '/grn' || pathname.startsWith('/grn/')
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isGroupActive = (group: MenuGroup) => {
    return group.items.some(item => isActive(item.href))
  }

  const canAccess = (permission: string | null, adminOnly?: boolean) => {
    if (adminOnly && userRole !== 'ADMIN') return false
    if (!permission) return true
    return hasPermission(userRole, permission, customPermissions)
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupName)) {
        newSet.delete(groupName)
      } else {
        newSet.add(groupName)
      }
      return newSet
    })
  }

  const renderMenuItem = (item: MenuItem, isSubItem = false) => {
    if (!canAccess(item.permission, item.adminOnly)) return null
    const Icon = item.icon
    const active = isActive(item.href)

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.title : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          collapsed && 'justify-center px-0',
          isSubItem && !collapsed && 'pl-10',
          active
            ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 shrink-0',
            isSubItem ? 'w-4 h-4' : 'w-5 h-5',
            active ? 'text-[var(--accent-primary)]' : ''
          )}
        />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </Link>
    )
  }

  const renderMenuGroup = (group: MenuGroup, groupKey: string) => {
    if (!canAccess(group.permission, group.adminOnly)) return null
    
    const Icon = group.icon
    const isExpanded = expandedGroups.has(groupKey)
    const isGroupCurrentlyActive = isGroupActive(group)

    return (
      <div key={groupKey}>
        <button
          onClick={() => !collapsed && toggleGroup(groupKey)}
          title={collapsed ? group.title : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            collapsed && 'justify-center px-0',
            isGroupCurrentlyActive
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          <Icon
            className={cn(
              'w-5 h-5 shrink-0',
              isGroupCurrentlyActive ? 'text-[var(--accent-primary)]' : ''
            )}
          />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{group.title}</span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </>
          )}
        </button>
        
        {/* Sub-items */}
        {!collapsed && isExpanded && (
          <div className="mt-1 space-y-0.5">
            {group.items.map(item => renderMenuItem(item, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className={cn(
        'bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-default)]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--accent-primary)] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Package className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-[var(--text-primary)] text-lg tracking-tight">
                Stock
              </h1>
              <p className="text-[11px] text-[var(--text-muted)] -mt-0.5">
                Management
              </p>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
            collapsed && 'hidden'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Collapse button for collapsed state */}
      {collapsed && (
        <div className="px-4 py-3 border-b border-[var(--border-default)]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="h-8 w-8 mx-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {/* Dashboard */}
        {renderMenuItem(dashboardItem)}
        
        {/* Stock & Products */}
        {!collapsed && (
          <div className="pt-4 mb-2 px-3">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              สินค้าและสต๊อค
            </span>
          </div>
        )}
        {collapsed && <div className="h-3" />}
        {stockMenuItems.map(item => renderMenuItem(item))}

        {/* Purchasing */}
        {!collapsed && (
          <div className="pt-4 mb-2 px-3">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              การจัดซื้อ
            </span>
          </div>
        )}
        {collapsed && <div className="h-3" />}
        {purchasingMenuItems.map(item => renderMenuItem(item))}

        {/* Reports Group */}
        {!collapsed && (
          <div className="pt-4 mb-2 px-3">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              วิเคราะห์
            </span>
          </div>
        )}
        {collapsed && <div className="h-3" />}
        {renderMenuGroup(reportsGroup, 'reports')}

        {/* Settings Link */}
        {(userRole === 'ADMIN') && (
          <>
            {!collapsed && (
              <div className="pt-4 mb-2 px-3">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  ระบบ
                </span>
              </div>
            )}
            {collapsed && <div className="h-3" />}
            {renderMenuItem(settingsMenuItem)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-default)]">
        <div
          className={cn(
            'text-[11px] text-[var(--text-muted)]',
            collapsed ? 'text-center' : ''
          )}
        >
          {collapsed ? 'v1.0' : 'v1.0.0 © 2026'}
        </div>
      </div>
    </aside>
  )
}
