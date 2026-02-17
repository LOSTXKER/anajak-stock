'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Scan, X, Search, Camera, Keyboard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  placeholder?: string
  autoFocus?: boolean
}

// Simple keyboard/USB scanner input
export function BarcodeInput({ 
  onScan, 
  placeholder = 'สแกน Barcode หรือพิมพ์...', 
  autoFocus = true 
}: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  function handleSubmit() {
    if (barcode.trim()) {
      onScan(barcode.trim())
      setBarcode('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <Input
          ref={inputRef}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10"
          autoFocus={autoFocus}
        />
      </div>
      <Button type="button" onClick={handleSubmit}>
        <Search className="w-4 h-4" />
      </Button>
    </div>
  )
}

// Camera-based barcode scanner
interface CameraScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [useFrontCamera, setUseFrontCamera] = useState(false)
  const scannerContainerId = useRef(`scanner-${Date.now()}`)
  const html5QrCodeRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const hasScannedRef = useRef(false)

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState()
        if (state === 2) { // SCANNING state
          await html5QrCodeRef.current.stop()
        }
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      html5QrCodeRef.current = null
    }
  }, [])

  const switchCamera = useCallback(async () => {
    setIsLoading(true)
    await stopScanner()
    setUseFrontCamera(prev => !prev)
  }, [stopScanner])

  useEffect(() => {
    let mounted = true

    async function startScanner() {
      if (!mounted) return

      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        
        if (!mounted) return

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 200))

        const container = document.getElementById(scannerContainerId.current)
        if (!container || !mounted) return

        const html5QrCode = new Html5Qrcode(scannerContainerId.current)
        html5QrCodeRef.current = html5QrCode

        // Use facingMode constraint - more reliable for mobile
        const facingMode = useFrontCamera ? 'user' : 'environment'

        await html5QrCode.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          (decodedText) => {
            if (!hasScannedRef.current && mounted) {
              hasScannedRef.current = true
              onScan(decodedText)
            }
          },
          () => {
            // QR code scan error (silent - happens on each frame without a QR)
          }
        )

        if (mounted) {
          setIsLoading(false)
        }
      } catch (err: unknown) {
        console.error('Scanner error:', err)
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          if (errorMessage.includes('Permission') || errorMessage.includes('permission') || errorMessage.includes('NotAllowed')) {
            setError('กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์')
          } else if (errorMessage.includes('NotFound') || errorMessage.includes('not found') || errorMessage.includes('ไม่พบกล้อง')) {
            setError('ไม่พบกล้องในอุปกรณ์นี้')
          } else if (errorMessage.includes('NotReadable') || errorMessage.includes('already in use')) {
            setError('กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปอื่นแล้วลองใหม่')
          } else if (errorMessage.includes('OverconstrainedError')) {
            // If back camera not available, try front
            if (!useFrontCamera) {
              setUseFrontCamera(true)
              return
            }
            setError('ไม่สามารถเปิดกล้องได้')
          } else {
            setError(`ไม่สามารถเปิดกล้องได้: ${errorMessage}`)
          }
          setIsLoading(false)
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      stopScanner()
    }
  }, [onScan, stopScanner, useFrontCamera])

  return (
    <div className="space-y-4">
      {isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--text-muted)]">กำลังเปิดกล้อง...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Camera className="w-12 h-12 text-[var(--status-error)]" />
          <p className="text-[var(--status-error)]">{error}</p>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      )}

      {/* Scanner container - video will be injected here by html5-qrcode */}
      <div 
        id={scannerContainerId.current}
        className="w-full overflow-hidden rounded-lg"
        style={{ 
          minHeight: isLoading || error ? 0 : 300,
          display: error ? 'none' : 'block'
        }}
      />

      {!isLoading && !error && (
        <div className="text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            หันกล้องไปที่ Barcode/QR Code
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={switchCamera}>
              <Camera className="w-4 h-4 mr-2" />
              {useFrontCamera ? 'กล้องหลัง' : 'กล้องหน้า'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Full barcode scanner with both keyboard and camera modes
export function BarcodeScanner({ onScan, placeholder }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'closed' | 'keyboard' | 'camera'>('closed')

  function handleScan(barcode: string) {
    onScan(barcode)
    setMode('closed')
    toast.success(`สแกนสำเร็จ: ${barcode}`)
  }

  if (mode === 'closed') {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setMode('keyboard')}
        >
          <Keyboard className="w-4 h-4 mr-2" />
          พิมพ์ Barcode
        </Button>
        <Button
          variant="outline"
          onClick={() => setMode('camera')}
        >
          <Camera className="w-4 h-4 mr-2" />
          สแกนกล้อง
        </Button>
      </div>
    )
  }

  if (mode === 'keyboard') {
    return (
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[var(--accent-primary)]" />
            พิมพ์ Barcode
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode('closed')}
            className="h-6 w-6"
            aria-label="ปิดสแกนเนอร์"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          <BarcodeInput onScan={handleScan} placeholder={placeholder} />
          <p className="text-xs text-[var(--text-muted)]">
            ใช้เครื่องสแกน USB หรือพิมพ์รหัสแล้วกด Enter
          </p>
        </CardContent>
      </Card>
    )
  }

  // Camera mode
  return (
    <Dialog open={mode === 'camera'} onOpenChange={() => setMode('closed')}>
      <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
            สแกน Barcode
          </DialogTitle>
        </DialogHeader>
        <CameraScanner onScan={handleScan} onClose={() => setMode('closed')} />
      </DialogContent>
    </Dialog>
  )
}

// Hook for listening to barcode scanner input (USB scanners)
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled = true) {
  const bufferRef = useRef('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    function handleKeyPress(e: KeyboardEvent) {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (e.key === 'Enter' && bufferRef.current.length > 0) {
        onScan(bufferRef.current)
        bufferRef.current = ''
      } else if (e.key.length === 1) {
        bufferRef.current += e.key
        // Reset buffer after 100ms of no input (barcode scanners are fast)
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 100)
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => {
      window.removeEventListener('keypress', handleKeyPress)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [onScan, enabled])
}

// Inline scanner button that opens camera
interface InlineScanButtonProps {
  onScan: (barcode: string) => void
  className?: string
}

export function InlineScanButton({ onScan, className }: InlineScanButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleScan(barcode: string) {
    onScan(barcode)
    setIsOpen(false)
    toast.success(`สแกนสำเร็จ: ${barcode}`)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className={className}
        aria-label="สแกนบาร์โค้ด"
      >
        <Scan className="w-4 h-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
              สแกน Barcode
            </DialogTitle>
          </DialogHeader>
          <CameraScanner onScan={handleScan} onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
