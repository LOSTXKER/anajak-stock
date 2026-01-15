'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // When route changes, complete the progress
    setIsLoading(false)
    setProgress(100)
    
    const timer = setTimeout(() => {
      setProgress(0)
    }, 200)

    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  useEffect(() => {
    if (isLoading) {
      // Animate progress
      setProgress(30)
      const timer1 = setTimeout(() => setProgress(50), 100)
      const timer2 = setTimeout(() => setProgress(70), 300)
      const timer3 = setTimeout(() => setProgress(85), 600)
      
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
  }, [isLoading])

  return (
    <>
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none"
        style={{ opacity: progress > 0 && progress < 100 ? 1 : 0 }}
      >
        <div
          className="h-full bg-[var(--accent-primary)] transition-all duration-200 ease-out"
          style={{
            width: `${progress}%`,
            boxShadow: '0 0 10px var(--accent-primary), 0 0 5px var(--accent-primary)',
          }}
        />
      </div>
    </>
  )
}

// Hook to trigger loading state
let setLoadingGlobal: ((loading: boolean) => void) | null = null

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)

  // Expose setLoading globally
  useEffect(() => {
    setLoadingGlobal = setIsLoading
    return () => {
      setLoadingGlobal = null
    }
  }, [])

  // When route changes, complete the progress
  useEffect(() => {
    setIsLoading(false)
    setProgress(100)
    
    const timer = setTimeout(() => {
      setProgress(0)
    }, 200)

    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  // Animate progress when loading
  useEffect(() => {
    if (isLoading) {
      setProgress(30)
      const timer1 = setTimeout(() => setProgress(50), 100)
      const timer2 = setTimeout(() => setProgress(70), 300)
      const timer3 = setTimeout(() => setProgress(85), 600)
      
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
  }, [isLoading])

  return (
    <>
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none"
        style={{ 
          opacity: progress > 0 && progress < 100 ? 1 : 0,
          transition: 'opacity 0.2s ease'
        }}
      >
        <div
          className="h-full bg-[var(--accent-primary)]"
          style={{
            width: `${progress}%`,
            transition: 'width 0.2s ease-out',
            boxShadow: '0 0 10px var(--accent-primary), 0 0 5px var(--accent-primary)',
          }}
        />
      </div>
      {children}
    </>
  )
}

export function startNavigation() {
  if (setLoadingGlobal) {
    setLoadingGlobal(true)
  }
}
