'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startProgress } from './navigation-progress'
import { ComponentProps, forwardRef, useCallback } from 'react'

type LinkProps = ComponentProps<typeof Link>

export const ProgressLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function ProgressLink({ href, onClick, children, ...props }, ref) {
    const router = useRouter()

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Call original onClick if exists
        onClick?.(e)

        // Don't trigger progress for:
        // - External links
        // - Same page anchors
        // - Prevented default
        if (e.defaultPrevented) return
        if (typeof href === 'string' && (href.startsWith('http') || href.startsWith('#'))) return

        // Start progress bar
        startProgress()
      },
      [href, onClick]
    )

    return (
      <Link ref={ref} href={href} onClick={handleClick} {...props}>
        {children}
      </Link>
    )
  }
)
