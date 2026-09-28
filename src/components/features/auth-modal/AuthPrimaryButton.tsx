'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export interface AuthPrimaryButtonProps {
  children: ReactNode
  disabled?: boolean
  /** Optional — omit when `type="submit"` so the wrapping `<form onSubmit>` is the single submit path. */
  onClick?: () => void
  /** Defaults to 'button'. Use 'submit' inside a `<form>` so password managers' save heuristic fires. */
  type?: 'button' | 'submit'
}

/**
 * The full-width CTA on every auth step.
 *
 * It stays a named component because the auth steps refer to it by intent rather
 * than by variant, but it is now just {@link Button} — it used to re-declare the
 * fill and drive its own hover by assigning `style.background` in onMouseEnter and
 * onMouseLeave, which a `hover:` class does for free and which left the hover state
 * stuck whenever the pointer left during a re-render. Its doc comment also still
 * called it "red", from the palette before the teal one.
 */
export function AuthPrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: AuthPrimaryButtonProps) {
  return (
    <Button type={type} onClick={onClick} disabled={disabled} size="cta-block">
      {children}
    </Button>
  )
}
