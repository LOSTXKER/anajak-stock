import { Role } from '@/generated/prisma'

// All available permissions in the system
export const ALL_PERMISSIONS = [
  // Products
  { key: 'products:read', label: 'ดูสินค้า', group: 'สินค้า' },
  { key: 'products:write', label: 'เพิ่ม/แก้ไขสินค้า', group: 'สินค้า' },
  // Stock
  { key: 'stock:read', label: 'ดูสต๊อค', group: 'คลังสินค้า' },
  { key: 'stock:write', label: 'ปรับปรุงสต๊อค', group: 'คลังสินค้า' },
  // Movements
  { key: 'movements:read', label: 'ดูการเคลื่อนไหว', group: 'เคลื่อนไหวสต๊อค' },
  { key: 'movements:write', label: 'สร้างการเคลื่อนไหว', group: 'เคลื่อนไหวสต๊อค' },
  { key: 'movements:approve', label: 'อนุมัติการเคลื่อนไหว', group: 'เคลื่อนไหวสต๊อค' },
  // Suppliers
  { key: 'suppliers:read', label: 'ดู Supplier', group: 'ซัพพลายเออร์' },
  { key: 'suppliers:write', label: 'จัดการ Supplier', group: 'ซัพพลายเออร์' },
  // PR
  { key: 'pr:read', label: 'ดูใบขอซื้อ', group: 'ใบขอซื้อ (PR)' },
  { key: 'pr:write', label: 'สร้างใบขอซื้อ', group: 'ใบขอซื้อ (PR)' },
  { key: 'pr:approve', label: 'อนุมัติใบขอซื้อ', group: 'ใบขอซื้อ (PR)' },
  // PO
  { key: 'po:read', label: 'ดูใบสั่งซื้อ', group: 'ใบสั่งซื้อ (PO)' },
  { key: 'po:write', label: 'สร้างใบสั่งซื้อ', group: 'ใบสั่งซื้อ (PO)' },
  { key: 'po:approve', label: 'อนุมัติใบสั่งซื้อ', group: 'ใบสั่งซื้อ (PO)' },
  // GRN
  { key: 'grn:read', label: 'ดูใบรับสินค้า', group: 'รับสินค้า (GRN)' },
  { key: 'grn:write', label: 'บันทึกรับสินค้า', group: 'รับสินค้า (GRN)' },
  // Stock Take
  { key: 'stock-take:read', label: 'ดูใบตรวจนับ', group: 'ตรวจนับสต๊อค' },
  { key: 'stock-take:write', label: 'สร้างใบตรวจนับ', group: 'ตรวจนับสต๊อค' },
  { key: 'stock-take:approve', label: 'อนุมัติใบตรวจนับ', group: 'ตรวจนับสต๊อค' },
  // Reports
  { key: 'reports:read', label: 'ดูรายงาน', group: 'รายงาน' },
] as const

export type PermissionKey = typeof ALL_PERMISSIONS[number]['key']

// Get permissions grouped by category
export function getPermissionsByGroup() {
  const groups: Record<string, typeof ALL_PERMISSIONS[number][]> = {}
  for (const perm of ALL_PERMISSIONS) {
    if (!groups[perm.group]) {
      groups[perm.group] = []
    }
    groups[perm.group].push(perm)
  }
  return groups
}

// Role-based access control helpers
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  ADMIN: ['*'], // All permissions
  INVENTORY: [
    'products:read',
    'products:write',
    'stock:read',
    'stock:write',
    'movements:read',
    'movements:write',
    'movements:approve',
    'grn:read',
    'grn:write',
    'stock-take:read',
    'stock-take:write',
  ],
  REQUESTER: [
    'products:read',
    'stock:read',
    'movements:read',
    'pr:read',
    'pr:write',
  ],
  APPROVER: [
    'products:read',
    'stock:read',
    'movements:read',
    'movements:approve',
    'pr:read',
    'pr:approve',
    'po:read',
    'po:approve',
    'stock-take:read',
    'stock-take:approve',
  ],
  PURCHASING: [
    'products:read',
    'stock:read',
    'suppliers:read',
    'suppliers:write',
    'pr:read',
    'po:read',
    'po:write',
    'grn:read',
    'grn:write',
  ],
  VIEWER: [
    'products:read',
    'stock:read',
    'movements:read',
    'pr:read',
    'po:read',
    'reports:read',
    'stock-take:read',
  ],
}

export type Permission = string

/**
 * Check if a user has a specific permission
 * @param role User's role
 * @param permission Permission to check
 * @param customPermissions Optional array of custom permissions
 */
export function hasPermission(
  role: Role, 
  permission: Permission, 
  customPermissions?: string[]
): boolean {
  // Check role permissions first
  const rolePerms = ROLE_PERMISSIONS[role]
  if (rolePerms.includes('*')) return true
  if (rolePerms.includes(permission)) return true
  
  // Check custom permissions
  if (customPermissions && customPermissions.includes(permission)) {
    return true
  }
  
  return false
}

export function hasAnyPermission(
  role: Role, 
  permissions: Permission[], 
  customPermissions?: string[]
): boolean {
  return permissions.some((p) => hasPermission(role, p, customPermissions))
}

export function hasAllPermissions(
  role: Role, 
  permissions: Permission[], 
  customPermissions?: string[]
): boolean {
  return permissions.every((p) => hasPermission(role, p, customPermissions))
}

/**
 * Get all effective permissions for a role + custom permissions
 */
export function getEffectivePermissions(role: Role, customPermissions?: string[]): string[] {
  const rolePerms = ROLE_PERMISSIONS[role]
  
  // Admin has all
  if (rolePerms.includes('*')) {
    return ALL_PERMISSIONS.map(p => p.key)
  }
  
  // Combine role + custom
  const combined = new Set([...rolePerms, ...(customPermissions || [])])
  return Array.from(combined)
}
