import { useState, useEffect } from 'react'

/**
 * Hook สำหรับ debounce value
 * ใช้สำหรับ search/filter เพื่อไม่ให้ query ทุกครั้งที่พิมพ์
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook สำหรับ debounce callback
 * ใช้สำหรับ actions ที่ต้องการ delay
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    const id = setTimeout(() => {
      callback(...args)
    }, delay)
    
    setTimeoutId(id)
  }
}
