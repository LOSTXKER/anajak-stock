import { createClient } from '@/lib/supabase/server'
import { prisma } from './prisma'
import { Role } from '@/generated/prisma'

// Re-export permissions utilities for convenience
export {
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Permission,
} from './permissions'

export interface SessionUser {
  id: string
  supabaseId: string
  email: string
  name: string
  role: Role
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return null
  }

  // First, try to find by supabaseId
  let dbUser = await prisma.user.findFirst({
    where: {
      supabaseId: user.id,
      active: true,
      deletedAt: null,
    },
  })

  // If not found by supabaseId, try to find by email and link
  if (!dbUser) {
    dbUser = await prisma.user.findFirst({
      where: {
        email: user.email,
        active: true,
        deletedAt: null,
      },
    })

    if (dbUser) {
      // Link existing user with supabase account
      try {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { supabaseId: user.id },
        })
      } catch {
        // Ignore if update fails (might be race condition)
      }
    }
  }

  // If still not found, create new user
  if (!dbUser) {
    const username = user.email.split('@')[0] || user.id.slice(0, 8)
    const name = user.user_metadata?.name || username

    try {
      // Use upsert to handle race conditions
      dbUser = await prisma.user.upsert({
        where: { supabaseId: user.id },
        update: {
          email: user.email,
          name,
        },
        create: {
          supabaseId: user.id,
          email: user.email,
          name,
          username: `${username}_${Date.now()}`, // Ensure unique username
          role: Role.VIEWER,
        },
      })
    } catch (error) {
      // If upsert fails, try to find again (race condition)
      dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { supabaseId: user.id },
            { email: user.email },
          ],
          active: true,
          deletedAt: null,
        },
      })

      if (!dbUser) {
        console.error('Failed to create or find user:', error)
        return null
      }
    }
  }

  return {
    id: dbUser.id,
    supabaseId: user.id,
    email: user.email,
    name: dbUser.name,
    role: dbUser.role,
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
