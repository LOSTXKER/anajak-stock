'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Role } from '@/generated/prisma'
import type { ActionResult } from '@/types'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Function to create Supabase Admin client (created on-demand, not at module load)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface UserListItem {
  id: string
  supabaseId: string | null
  username: string
  email: string | null
  name: string
  role: Role
  customPermissions: string[]
  active: boolean
  createdAt: Date
}

// Validation schema for creating user
const createUserSchema = z.object({
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  name: z.string().min(1, 'กรุณาระบุชื่อ'),
  username: z.string().min(3, 'Username ต้องมีอย่างน้อย 3 ตัวอักษร').regex(/^[a-zA-Z0-9_]+$/, 'Username ใช้ได้เฉพาะ a-z, 0-9, _'),
  role: z.enum(['ADMIN', 'APPROVER', 'INVENTORY', 'REQUESTER', 'PURCHASING', 'VIEWER']),
  customPermissions: z.array(z.string()).optional(),
})

export async function getUsers(): Promise<UserListItem[]> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return []
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      supabaseId: true,
      username: true,
      email: true,
      name: true,
      role: true,
      customPermissions: true,
      active: true,
      createdAt: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return users
}

export async function createUser(input: {
  email: string
  password: string
  name: string
  username: string
  role: Role
  customPermissions?: string[]
}): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  // Validate input
  const validation = createUserSchema.safeParse(input)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message }
  }

  const { email, password, name, username, role, customPermissions = [] } = validation.data

  try {
    // Check if username already exists
    const existingUsername = await prisma.user.findFirst({
      where: { username, deletedAt: null },
    })
    if (existingUsername) {
      return { success: false, error: 'Username นี้ถูกใช้แล้ว' }
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    })
    if (existingEmail) {
      return { success: false, error: 'อีเมลนี้ถูกใช้แล้ว' }
    }

    // Create user in Supabase Auth
    const supabaseAdmin = getSupabaseAdmin()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name, username },
    })

    if (authError || !authData.user) {
      console.error('Supabase auth error:', authError)
      return { success: false, error: authError?.message || 'ไม่สามารถสร้างผู้ใช้ใน Auth ได้' }
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email,
        username,
        name,
        role,
        customPermissions,
        active: true,
      },
      select: { id: true },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'CREATE',
        refType: 'USER',
        refId: user.id,
        newData: { email, username, name, role, customPermissions },
      },
    })

    revalidatePath('/settings/users')

    return { success: true, data: user }
  } catch (error) {
    console.error('Create user error:', error)
    return { success: false, error: 'ไม่สามารถสร้างผู้ใช้ได้' }
  }
}

export async function updateUserRole(
  userId: string,
  role: Role
): Promise<ActionResult<{ id: string; role: Role }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  // Prevent admin from changing their own role
  if (userId === session.id) {
    return { success: false, error: 'ไม่สามารถเปลี่ยน Role ของตัวเองได้' }
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE_ROLE',
        refType: 'USER',
        refId: userId,
        newData: { role },
      },
    })

    revalidatePath('/settings/users')

    return { success: true, data: user }
  } catch (error) {
    console.error('Update user role error:', error)
    return { success: false, error: 'ไม่สามารถเปลี่ยน Role ได้' }
  }
}

export async function updateUserPermissions(
  userId: string,
  customPermissions: string[]
): Promise<ActionResult<{ id: string; customPermissions: string[] }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { customPermissions },
      select: { id: true, customPermissions: true },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'UPDATE_PERMISSIONS',
        refType: 'USER',
        refId: userId,
        newData: { customPermissions },
      },
    })

    revalidatePath('/settings/users')

    return { success: true, data: user }
  } catch (error) {
    console.error('Update user permissions error:', error)
    return { success: false, error: 'ไม่สามารถเปลี่ยนสิทธิ์ได้' }
  }
}

export async function toggleUserActive(
  userId: string,
  active: boolean
): Promise<ActionResult<{ id: string; active: boolean }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  // Prevent admin from deactivating themselves
  if (userId === session.id && !active) {
    return { success: false, error: 'ไม่สามารถปิดใช้งานตัวเองได้' }
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { active },
      select: { id: true, active: true },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        refType: 'USER',
        refId: userId,
        newData: { active },
      },
    })

    revalidatePath('/settings/users')

    return { success: true, data: user }
  } catch (error) {
    console.error('Toggle user active error:', error)
    return { success: false, error: 'ไม่สามารถเปลี่ยนสถานะได้' }
  }
}

export async function deleteUser(userId: string): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }
  }

  // Prevent admin from deleting themselves
  if (userId === session.id) {
    return { success: false, error: 'ไม่สามารถลบตัวเองได้' }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        active: false,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: session.id,
        action: 'DELETE',
        refType: 'USER',
        refId: userId,
      },
    })

    revalidatePath('/settings/users')

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Delete user error:', error)
    return { success: false, error: 'ไม่สามารถลบผู้ใช้ได้' }
  }
}
