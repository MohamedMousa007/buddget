'use client'

import type { ReactNode } from 'react'

export interface AuthPrimaryButtonProps {
  children: ReactNode
  disabled?: boolean
  /** Optional — omit when `type="submit"` so the wrapping `<form onSubmit>` is the single submit path. */
  onClick?: () => void
  /** Defaults to 'button'. Use 'submit' inside a `<form>` so password managers' save heuristic fires. */
  type?: 'button' | 'submit'
}

const BG = 'var(--color-brand-red)'
const BG_HOVER = 'var(--color-brand-red-hover)'

/**
 * Full-width red CTA used across auth steps.
 */
export function AuthPrimaryButton({ children, disabled, onClick, type = 'button' }: AuthPrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: BG }}
      onMouseEnter={(e) => {
        if (!disabled) (e.target as HTMLButtonElement).style.background = BG_HOVER
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLButtonElement).style.background = BG
      }}
    >
      {children}
    </button>
  )
}
