/**
 * Toast Helper Functions
 * Provides consistent toast notifications across the app
 */

import { toast, type ExternalToast } from 'sonner'

// Common toast options
const defaultOptions: ExternalToast = {
  duration: 4000,
}

/**
 * Show a success toast
 */
export function showSuccess(message: string, options?: ExternalToast) {
  return toast.success(message, { ...defaultOptions, ...options })
}

/**
 * Show an error toast
 */
export function showError(error: unknown, options?: ExternalToast) {
  const message = getErrorMessage(error)
  return toast.error(message, { ...defaultOptions, duration: 5000, ...options })
}

/**
 * Show an info toast
 */
export function showInfo(message: string, options?: ExternalToast) {
  return toast.info(message, { ...defaultOptions, ...options })
}

/**
 * Show a warning toast
 */
export function showWarning(message: string, options?: ExternalToast) {
  return toast.warning(message, { ...defaultOptions, ...options })
}

/**
 * Show a loading toast
 */
export function showLoading(message: string, options?: ExternalToast) {
  return toast.loading(message, { ...defaultOptions, ...options })
}

/**
 * Dismiss a specific toast or all toasts
 */
export function dismissToast(toastId?: string | number) {
  if (toastId) {
    toast.dismiss(toastId)
  } else {
    toast.dismiss()
  }
}

/**
 * Wrap an async operation with loading/success/error toasts
 * Great for long operations like imports, exports, batch operations
 */
export async function withToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error?: string | ((error: unknown) => string)
  }
): Promise<T> {
  toast.promise(promise, {
    loading: messages.loading,
    success: (data) => 
      typeof messages.success === 'function' 
        ? messages.success(data) 
        : messages.success,
    error: (err) => 
      messages.error 
        ? (typeof messages.error === 'function' ? messages.error(err) : messages.error)
        : getErrorMessage(err),
  })
  return promise
}

/**
 * Action toast - for quick actions with undo functionality
 */
export function showAction(
  message: string,
  options: {
    action?: {
      label: string
      onClick: () => void
    }
    cancel?: {
      label: string
      onClick: () => void
    }
    duration?: number
  }
) {
  return toast(message, {
    ...defaultOptions,
    duration: options.duration || 5000,
    action: options.action,
    cancel: options.cancel,
  })
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (typeof error === 'object' && error !== null) {
    // Handle action result errors
    if ('error' in error && typeof (error as { error: unknown }).error === 'string') {
      return (error as { error: string }).error
    }
    // Handle API response errors
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
  }
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
}

// Pre-defined toast messages for common operations
export const toastMessages = {
  // CRUD Operations
  create: {
    loading: 'กำลังบันทึก...',
    success: 'บันทึกเรียบร้อยแล้ว',
    error: 'ไม่สามารถบันทึกได้',
  },
  update: {
    loading: 'กำลังอัปเดต...',
    success: 'อัปเดตเรียบร้อยแล้ว',
    error: 'ไม่สามารถอัปเดตได้',
  },
  delete: {
    loading: 'กำลังลบ...',
    success: 'ลบเรียบร้อยแล้ว',
    error: 'ไม่สามารถลบได้',
  },
  
  // Document Operations
  submit: {
    loading: 'กำลังส่งเอกสาร...',
    success: 'ส่งเอกสารเรียบร้อยแล้ว',
    error: 'ไม่สามารถส่งเอกสารได้',
  },
  approve: {
    loading: 'กำลังอนุมัติ...',
    success: 'อนุมัติเรียบร้อยแล้ว',
    error: 'ไม่สามารถอนุมัติได้',
  },
  reject: {
    loading: 'กำลังปฏิเสธ...',
    success: 'ปฏิเสธเรียบร้อยแล้ว',
    error: 'ไม่สามารถปฏิเสธได้',
  },
  cancel: {
    loading: 'กำลังยกเลิก...',
    success: 'ยกเลิกเรียบร้อยแล้ว',
    error: 'ไม่สามารถยกเลิกได้',
  },
  post: {
    loading: 'กำลังบันทึกเข้าสต๊อค...',
    success: 'บันทึกเข้าสต๊อคเรียบร้อยแล้ว',
    error: 'ไม่สามารถบันทึกเข้าสต๊อคได้',
  },
  
  // Import/Export
  import: {
    loading: 'กำลังนำเข้าข้อมูล...',
    success: (count: number) => `นำเข้าข้อมูลสำเร็จ ${count} รายการ`,
    error: 'ไม่สามารถนำเข้าข้อมูลได้',
  },
  export: {
    loading: 'กำลังส่งออกข้อมูล...',
    success: 'ส่งออกข้อมูลเรียบร้อยแล้ว',
    error: 'ไม่สามารถส่งออกข้อมูลได้',
  },
  
  // File Operations
  upload: {
    loading: 'กำลังอัปโหลด...',
    success: 'อัปโหลดเรียบร้อยแล้ว',
    error: 'ไม่สามารถอัปโหลดได้',
  },
  download: {
    loading: 'กำลังดาวน์โหลด...',
    success: 'ดาวน์โหลดเรียบร้อยแล้ว',
    error: 'ไม่สามารถดาวน์โหลดได้',
  },
} as const
