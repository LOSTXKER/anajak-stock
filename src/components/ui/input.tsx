import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        "flex h-10 w-full rounded-lg border bg-[var(--bg-primary)] px-3 py-2 text-sm transition-all duration-200",
        // Border and shadow
        "border-[var(--border-default)] shadow-xs",
        // Text and placeholder
        "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
        // Selection
        "selection:bg-[var(--accent-100)] selection:text-[var(--accent-900)]",
        // Focus state
        "focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20",
        // Hover state
        "hover:border-[var(--border-hover)]",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-secondary)]",
        // File input styles
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)]",
        // Error state
        "aria-invalid:border-[var(--status-error)] aria-invalid:ring-[var(--status-error)]/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
