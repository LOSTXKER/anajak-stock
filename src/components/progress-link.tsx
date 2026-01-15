'use client'

import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { startNavigation } from './navigation-progress'
import React, { forwardRef } from 'react'

interface ProgressLinkProps extends LinkProps {
  children: React.ReactNode
  className?: string
}

/**
 * A Link component that triggers the navigation progress bar
 * Use this instead of next/link for instant visual feedback
 */
export const ProgressLink = forwardRef<HTMLAnchorElement, ProgressLinkProps>(
  function ProgressLink({ children, className, href, onClick, ...props }, ref) {
    const pathname = usePathname()
    
    // Check if we're navigating to a different page
    const hrefString = typeof href === 'string' ? href : href.pathname || ''
    const isSamePage = hrefString === pathname || hrefString.split('?')[0] === pathname

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Only trigger progress if navigating to different page/params
      if (!isSamePage || hrefString.includes('?')) {
        startNavigation()
      }
      onClick?.(e)
    }

    return (
      <Link
        ref={ref}
        href={href}
        onClick={handleClick}
        className={className}
        {...props}
      >
        {children}
      </Link>
    )
  }
)
