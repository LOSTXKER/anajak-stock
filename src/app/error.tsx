'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-[var(--status-error-light)] flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-[var(--status-error)]" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">เกิดข้อผิดพลาด</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        ลองใหม่
      </Button>
    </div>
  )
}
