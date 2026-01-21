/**
 * Date utilities for Thai timezone (Asia/Bangkok, UTC+7)
 */

const THAI_TIMEZONE = 'Asia/Bangkok'
const THAI_LOCALE = 'th-TH'

/**
 * Format date to Thai locale with Thai timezone
 */
export function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  
  return d.toLocaleDateString(THAI_LOCALE, { ...defaultOptions, ...options })
}

/**
 * Format date with time
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  
  return d.toLocaleString(THAI_LOCALE, { ...defaultOptions, ...options })
}

/**
 * Format date as short (e.g., "21 ม.ค.")
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  return formatDate(date, {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Format date as long (e.g., "21 มกราคม 2569")
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  return formatDate(date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format date with weekday (e.g., "จันทร์ 21 มกราคม")
 */
export function formatDateWithWeekday(date: Date | string | null | undefined): string {
  return formatDate(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Format time only (e.g., "14:30")
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  return d.toLocaleTimeString(THAI_LOCALE, {
    timeZone: THAI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format relative time (e.g., "3 ชั่วโมงที่แล้ว")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 60) return 'เมื่อสักครู่'
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`
  
  return formatDate(d)
}

/**
 * Get current date in Thai timezone as ISO string (YYYY-MM-DD)
 */
export function getTodayThai(): string {
  const now = new Date()
  return now.toLocaleDateString('sv-SE', { timeZone: THAI_TIMEZONE }) // sv-SE gives YYYY-MM-DD format
}

/**
 * Check if date is today (Thai timezone)
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return false
  
  const today = getTodayThai()
  const dateStr = d.toLocaleDateString('sv-SE', { timeZone: THAI_TIMEZONE })
  
  return today === dateStr
}
