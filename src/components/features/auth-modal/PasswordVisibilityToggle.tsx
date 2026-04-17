'use client'

import { Eye, EyeOff } from 'lucide-react'

export interface PasswordVisibilityToggleProps {
  visible: boolean
  onToggle: () => void
  /** Localised aria-label — should swap between "Show password" / "Hide password". */
  label: string
}

/**
 * Eye / EyeOff button positioned at the end edge of a password input. Shared by the
 * auth modal (`AuthCredentialFields`) and the reset-password confirm page so both
 * surfaces look and behave identically.
 */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
  label,
}: PasswordVisibilityToggleProps) {
  const Icon = visible ? EyeOff : Eye
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors p-1 -m-1"
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
