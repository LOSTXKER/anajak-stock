/**
 * Custom error classes for application-wide error handling
 */

// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Authentication error - user not logged in
export class AuthError extends AppError {
  constructor(message: string = 'กรุณาเข้าสู่ระบบ') {
    super(message, 'AUTH_ERROR', 401)
    this.name = 'AuthError'
  }
}

// Permission error - user doesn't have required permission
export class PermissionError extends AppError {
  constructor(message: string = 'คุณไม่มีสิทธิ์ดำเนินการนี้') {
    super(message, 'PERMISSION_ERROR', 403)
    this.name = 'PermissionError'
  }
}

// Validation error - invalid input data
export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

// Not found error - resource doesn't exist
export class NotFoundError extends AppError {
  constructor(resource: string = 'ข้อมูล') {
    super(`ไม่พบ${resource}`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

// Conflict error - resource already exists or state conflict
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
    this.name = 'ConflictError'
  }
}

// Business logic error - operation not allowed due to business rules
export class BusinessError extends AppError {
  constructor(message: string) {
    super(message, 'BUSINESS_ERROR', 422)
    this.name = 'BusinessError'
  }
}

/**
 * Log error with context (can be extended for external logging services)
 */
export function logError(
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    ...context,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  }

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', JSON.stringify(errorInfo, null, 2))
  } else {
    // In production, could send to external logging service
    console.error('[ERROR]', JSON.stringify(errorInfo))
  }
}

/**
 * Extract user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Error) {
    // Prisma unique constraint error
    if (error.message.includes('Unique constraint failed')) {
      return 'ข้อมูลนี้มีอยู่ในระบบแล้ว'
    }

    // Prisma foreign key constraint error
    if (error.message.includes('Foreign key constraint failed')) {
      return 'ไม่สามารถลบข้อมูลได้เนื่องจากมีการใช้งานอยู่'
    }

    // Return generic message for unknown errors
    return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  }

  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
}
