import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Base styles
        "flex min-h-[100px] w-full rounded-lg border bg-[var(--bg-primary)] px-3 py-2 text-sm transition-all duration-200",
        // Border and shadow
        "border-[var(--border-default)] shadow-xs",
        // Text and placeholder
        "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
        // Focus state
        "focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20",
        // Hover state
        "hover:border-[var(--border-hover)]",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-secondary)]",
        // Error state
        "aria-invalid:border-[var(--status-error)] aria-invalid:ring-[var(--status-error)]/20",
        // Resize
        "resize-y",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
