'use client'

import { useEffect, useTransition, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  speed: 300,
  trickleSpeed: 200,
})

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Stop progress bar when navigation completes
    NProgress.done()
  }, [pathname, searchParams])

  return null
}

// Hook to use for manual progress control
export function useNavigationProgress() {
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isPending) {
      NProgress.start()
    } else {
      NProgress.done()
    }
  }, [isPending])

  const withProgress = useCallback(<T,>(fn: () => T): T => {
    NProgress.start()
    try {
      return fn()
    } finally {
      // Done will be called when navigation completes
    }
  }, [])

  return { isPending, startTransition, withProgress }
}

// Start progress on link click
export function startProgress() {
  NProgress.start()
}

export function stopProgress() {
  NProgress.done()
}
