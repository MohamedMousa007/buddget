import type { CSSProperties } from 'react'

/** Shared visual tokens for the sign-in modal. Themes via brand CSS variables. */

export const MIN_PASSWORD_LEN = 8

export const cardStyle: CSSProperties = {
  background: 'var(--color-brand-card)',
  borderColor: 'var(--color-brand-border)',
  borderRadius: 16,
  maxWidth: 400,
}

// 15px: slightly tighter than text-base so the email fits more chars when the
// biometric button steals width; native shell locks viewport scale so iOS
// focus-zoom (the reason 16px is usually the floor) can't trigger here.
export const inputClass =
  'w-full h-10 sm:h-11 px-3 rounded-[10px] border text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none transition-colors text-[15px]'

export const inputStyle: CSSProperties = {
  background: 'var(--color-brand-elevated)',
  borderColor: 'var(--color-brand-border)',
}

/**
 * Default (neutral) focus ring. Red is reserved for validation errors, green for
 * successful validation. See `inputFocusError` / `inputFocusValid` below.
 */
export const inputFocus =
  'focus:border-[var(--color-brand-text-secondary)] focus:ring-1 focus:ring-[var(--color-brand-text-secondary)]/30'

export const inputFocusError =
  'border-[var(--color-brand-red)] focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)]/40'

export const inputFocusValid =
  'border-[var(--color-brand-green)] focus:border-[var(--color-brand-green)] focus:ring-1 focus:ring-[var(--color-brand-green)]/40'

export const primaryBtn =
  'w-full h-11 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
