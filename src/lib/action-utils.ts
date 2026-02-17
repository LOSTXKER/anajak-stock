/**
 * Server Action utility functions
 * Provides wrappers for common patterns like auth checking, permission validation, and error handling
 */

import { getSession, hasPermission, type SessionUser, type Permission } from './auth'
import { AppError, AuthError, PermissionError, logError, getErrorMessage } from './errors'
import type { ActionResult } from '@/types'

/**
 * Wrapper for server actions that require authentication
 * Automatically checks session and injects it into the handler
 *
 * @example
 * export const createProduct = withAuth(async (session, data: ProductInput) => {
 *   // session is guaranteed to be valid here
 *   const product = await prisma.product.create({ ... })
 *   return { success: true, data: product }
 * })
 */
export function withAuth<TArgs extends unknown[], TResult>(
  handler: (session: SessionUser, ...args: TArgs) => Promise<ActionResult<TResult>>
) {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    try {
      const session = await getSession()

      if (!session) {
        return { success: false, error: 'กรุณาเข้าสู่ระบบ' }
      }

      return await handler(session, ...args)
    } catch (error) {
      return handleActionError(error, 'withAuth')
    }
  }
}

/**
 * Wrapper for server actions that require specific permission
 * Automatically checks session and permission
 *
 * @example
 * export const deleteProduct = withPermission('products:delete', async (session, id: string) => {
 *   await prisma.product.delete({ where: { id } })
 *   return { success: true, data: undefined }
 * })
 */
export function withPermission<TArgs extends unknown[], TResult>(
  permission: Permission,
  handler: (session: SessionUser, ...args: TArgs) => Promise<ActionResult<TResult>>
) {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    try {
      const session = await getSession()

      if (!session) {
        return { success: false, error: 'กรุณาเข้าสู่ระบบ' }
      }

      if (!hasPermission(session.role, permission)) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' }
      }

      return await handler(session, ...args)
    } catch (error) {
      return handleActionError(error, `withPermission:${permission}`)
    }
  }
}

/**
 * Wrapper for server actions that require any of the specified permissions
 *
 * @example
 * export const viewStock = withAnyPermission(['stock:read', 'inventory:read'], async (session) => {
 *   // ...
 * })
 */
export function withAnyPermission<TArgs extends unknown[], TResult>(
  permissions: Permission[],
  handler: (session: SessionUser, ...args: TArgs) => Promise<ActionResult<TResult>>
) {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    try {
      const session = await getSession()

      if (!session) {
        return { success: false, error: 'กรุณาเข้าสู่ระบบ' }
      }

      const hasAny = permissions.some((p) => hasPermission(session.role, p))
      if (!hasAny) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' }
      }

      return await handler(session, ...args)
    } catch (error) {
      return handleActionError(error, `withAnyPermission:${permissions.join(',')}`)
    }
  }
}

/**
 * Unified error handler for server actions
 * Logs error and returns user-friendly error message
 *
 * @example
 * try {
 *   // ... action logic
 * } catch (error) {
 *   return handleActionError(error, 'createProduct')
 * }
 */
export function handleActionError<T = never>(
  error: unknown,
  context?: string
): ActionResult<T> {
  // Log the error with context
  logError(error, { context })

  // Return user-friendly error message
  const message = getErrorMessage(error)

  return { success: false, error: message }
}

/**
 * Helper to create a success result
 */
export function success<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

/**
 * Helper to create a failure result
 */
export function failure(error: string): ActionResult<never> {
  return { success: false, error }
}

/**
 * Validate input using Zod schema and return ActionResult
 *
 * @example
 * const validation = validateInput(productSchema, input)
 * if (!validation.success) return validation
 * const data = validation.data
 */
export function validateInput<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } },
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(input)

  if (!result.success) {
    const message = result.error?.issues.map(i => i.message).join(', ') || 'ข้อมูลไม่ถูกต้อง'
    return { success: false, error: message }
  }

  return { success: true, data: result.data as T }
}

/**
 * Re-export error classes for convenience
 */
export { AppError, AuthError, PermissionError } from './errors'
export { NotFoundError, ValidationError, ConflictError, BusinessError } from './errors'
