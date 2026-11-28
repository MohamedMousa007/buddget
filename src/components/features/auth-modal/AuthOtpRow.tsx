'use client'

import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { toLatinDigits } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { useOtpAutofill } from '@/hooks/useOtpAutofill'
import { EMAIL_OTP_LENGTH, placeOtpDigit } from '@/lib/auth/otp'
import { inputFocus, inputStyle } from '@/components/features/auth-modal/authModalTokens'

export interface AuthOtpRowProps {
  value: string
  onChange: (six: string) => void
  disabled?: boolean
}

/**
 * Six single-digit inputs for email OTP verification.
 */
export function AuthOtpRow({ value, onChange, disabled }: AuthOtpRowProps) {
  const a = useT().a11y
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digitsOnly = toLatinDigits(value).replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH)
  const chars = (digitsOnly + ' '.repeat(EMAIL_OTP_LENGTH)).slice(0, EMAIL_OTP_LENGTH).split('')

  // Android: pull a freshly-copied code from the clipboard on resume. iOS fills
  // via the input's one-time-code autocomplete (handled as multi-char below).
  useOtpAutofill((code) => onChange(code), digitsOnly.length < EMAIL_OTP_LENGTH)

  const setDigit = (i: number, raw: string) => {
    const { code, focus } = placeOtpDigit(digitsOnly, i, toLatinDigits(raw))
    onChange(code)
    if (focus !== i) refs.current[focus]?.focus()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return
    const v = digitsOnly
    if (v[i]) {
      onChange(v.slice(0, i) + v.slice(i + 1))
    } else if (i > 0) {
      refs.current[i - 1]?.focus()
      onChange(v.slice(0, i - 1) + v.slice(i))
    }
    e.preventDefault()
  }

  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const t = toLatinDigits(e.clipboardData.getData('text')).replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH)
    onChange(t)
    refs.current[Math.min(t.length, EMAIL_OTP_LENGTH - 1)]?.focus()
  }

  return (
    <div role="group" aria-label={a.otpCode} className="flex justify-center gap-2 sm:gap-2.5" onPaste={onPaste}>
      {Array.from({ length: EMAIL_OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          aria-label={a.otpDigit(i + 1, EMAIL_OTP_LENGTH)}
          disabled={disabled}
          value={chars[i]?.trim() ? chars[i] : ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            'w-12 h-14 sm:w-12 rounded-md border text-center text-2xl outline-none transition-colors disabled:opacity-50',
            // Set on the input itself: inside the auth screen's `.dark` scope the inherited ink is still the light theme's.
            'text-[var(--color-brand-text-primary)] caret-[var(--color-brand-text-primary)] [-webkit-text-fill-color:var(--color-brand-text-primary)]',
            'autofill:shadow-[inset_0_0_0_100px_var(--color-brand-elevated)]',
            inputFocus
          )}
          style={{
            ...inputStyle,
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
          }}
        />
      ))}
    </div>
  )
}
