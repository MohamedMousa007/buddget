"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "./buttonVariants"

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * Shows a spinner and blocks further presses. Also sets `aria-busy`, so the
     * wait is announced rather than only drawn — a dozen call sites previously
     * swapped the label to "Saving…" and left assistive tech with no signal.
     */
    loading?: boolean
    /** Replaces the label while loading, e.g. "Saving…". The spinner shows either way. */
    loadingText?: string
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {loading && loadingText ? loadingText : children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
