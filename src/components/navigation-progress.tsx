'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Global state for navigation progress
let globalSetLoading: ((loading: boolean) => void) | null = null

export function startNavigation() {
  globalSetLoading?.(true)
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Expose setLoading globally
  useEffect(() => {
    globalSetLoading = setIsLoading
    return () => {
      globalSetLoading = null
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

  // Global click handler for all links
  const handleGlobalClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    const link = target.closest('a')
    
    if (!link) return
    
    const href = link.getAttribute('href')
    if (!href) return
    
    // Skip external links, hash links, and non-navigation links
    if (
      href.startsWith('http') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#') ||
      link.getAttribute('target') === '_blank' ||
      link.getAttribute('download') !== null
    ) {
      return
    }
    
    // Skip if it's the same page (exact match)
    const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    if (href === currentPath || href === pathname) {
      return
    }
    
    // Start navigation progress
    setIsLoading(true)
  }, [pathname, searchParams])

  // Attach global click listener
  useEffect(() => {
    document.addEventListener('click', handleGlobalClick)
    return () => {
      document.removeEventListener('click', handleGlobalClick)
    }
  }, [handleGlobalClick])

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
