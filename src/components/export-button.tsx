'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExportButtonProps {
  endpoint: string
  filename?: string
  label?: string
  className?: string
}

export function ExportButton({
  endpoint,
  filename,
  label = 'Export Excel',
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    setIsExporting(true)
    try {
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || getFilenameFromResponse(response) || 'export.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('ดาวน์โหลดสำเร็จ')
    } catch {
      toast.error('ไม่สามารถ Export ได้')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      className={className}
    >
      {isExporting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          กำลัง Export...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  )
}

function getFilenameFromResponse(response: Response): string | null {
  const disposition = response.headers.get('Content-Disposition')
  if (!disposition) return null
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match ? match[1] : null
}
