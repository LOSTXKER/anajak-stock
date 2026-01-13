import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-primary)] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-primary)] text-white shadow-sm hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)]",
        destructive:
          "bg-[var(--status-error)] text-white shadow-sm hover:bg-[var(--status-error-dark)] focus-visible:ring-[var(--status-error)]",
        outline:
          "border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xs hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)] text-[var(--text-primary)]",
        secondary:
          "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-xs hover:bg-[var(--bg-tertiary)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
        link: 
          "text-[var(--accent-primary)] underline-offset-4 hover:underline hover:text-[var(--accent-primary-hover)]",
        success:
          "bg-[var(--status-success)] text-white shadow-sm hover:bg-[var(--status-success-dark)] focus-visible:ring-[var(--status-success)]",
        warning:
          "bg-[var(--status-warning)] text-white shadow-sm hover:bg-[var(--status-warning-dark)] focus-visible:ring-[var(--status-warning)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        xl: "h-12 rounded-xl px-8 text-base",
        icon: "size-9 rounded-lg",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
