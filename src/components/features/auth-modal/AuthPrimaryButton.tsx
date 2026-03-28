'use client'

import type { ReactNode } from 'react'

export interface AuthPrimaryButtonProps {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}

const BG = '#E50914'
const BG_HOVER = '#F40612'

/**
 * Full-width red CTA used across auth steps.
 */
export function AuthPrimaryButton({ children, disabled, onClick }: AuthPrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
