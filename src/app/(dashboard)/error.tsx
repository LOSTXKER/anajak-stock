'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-[var(--status-error-light)] flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-[var(--status-error)]" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">เกิดข้อผิดพลาด</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || 'เกิดข้อผิดพลาดในการโหลดหน้านี้ กรุณาลองใหม่อีกครั้ง'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          ลองใหม่
        </Button>
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/dashboard">
            <Home className="w-4 h-4" />
            กลับหน้าหลัก
          </Link>
        </Button>
      </div>
    </div>
  )
}
