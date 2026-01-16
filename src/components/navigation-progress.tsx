'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Global state for navigation progress
let globalSetLoading: ((loading: boolean) => void) | null = null
let globalStopNavigation: (() => void) | null = null

export function startNavigation() {
  globalSetLoading?.(true)
}

export function stopNavigation() {
  globalStopNavigation?.()
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isLongLoad, setIsLongLoad] = useState(false)
  const loadStartTime = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Expose setLoading globally
  useEffect(() => {
    globalSetLoading = setIsLoading
    globalStopNavigation = () => {
      setIsLoading(false)
      setProgress(100)
    }
    return () => {
      globalSetLoading = null
      globalStopNavigation = null
    }
  }, [])

  // When route changes, complete the progress
  useEffect(() => {
    setIsLoading(false)
    setIsLongLoad(false)
    setProgress(100)
    
    // Clear any running intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    const timer = setTimeout(() => {
      setProgress(0)
    }, 300)

    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  // Animate progress when loading with smoother increments
  useEffect(() => {
    if (isLoading) {
      loadStartTime.current = Date.now()
      setProgress(15)
      setIsLongLoad(false)
      
      // Smooth incremental progress
      const timers: NodeJS.Timeout[] = []
      timers.push(setTimeout(() => setProgress(30), 100))
      timers.push(setTimeout(() => setProgress(45), 250))
      timers.push(setTimeout(() => setProgress(60), 500))
      timers.push(setTimeout(() => setProgress(75), 1000))
      timers.push(setTimeout(() => setProgress(85), 2000))
      
      // Mark as long load after 2 seconds
      timers.push(setTimeout(() => setIsLongLoad(true), 2000))
      
      // Slow increment for long loads (never reach 100)
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev
          return prev + (98 - prev) * 0.05
        })
      }, 500)
      
      return () => {
        timers.forEach(t => clearTimeout(t))
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
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

  const isVisible = progress > 0 && progress < 100

  return (
    <>
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none overflow-hidden"
        style={{ 
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      >
        {/* Main progress bar */}
        <div
          className="h-full bg-[var(--accent-primary)] relative"
          style={{
            width: `${progress}%`,
            transition: isVisible ? 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            boxShadow: '0 0 12px var(--accent-primary), 0 0 6px var(--accent-primary)',
          }}
        >
          {/* Shine effect */}
          <div 
            className="absolute inset-0 overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: isLongLoad ? 'shine 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
        
        {/* Pulse effect for long loads */}
        {isLongLoad && (
          <div
            className="absolute top-0 right-0 h-full w-24 animate-pulse"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--accent-primary))',
              opacity: 0.5,
            }}
          />
        )}
      </div>
      
      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
      
      {children}
    </>
  )
}
