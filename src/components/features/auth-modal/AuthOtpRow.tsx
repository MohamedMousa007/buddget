'use client'

import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { useOtpAutofill } from '@/hooks/useOtpAutofill'
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
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digitsOnly = value.replace(/\D/g, '').slice(0, 6)
  const chars = (digitsOnly + '      ').slice(0, 6).split('')

  // Android: pull a freshly-copied code from the clipboard on resume. iOS fills
  // via the input's one-time-code autocomplete (handled as multi-char below).
  useOtpAutofill((code) => onChange(code), digitsOnly.length < 6)

  const setDigit = (i: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '')
    // Autofill / QuickType inserts the whole code into one box — distribute it.
    if (cleaned.length > 1) {
      const code = cleaned.slice(0, 6)
      onChange(code)
      refs.current[Math.min(code.length, 5)]?.focus()
      return
    }
    const padded = (digitsOnly + '      ').slice(0, 6).split('')
    padded[i] = cleaned || ' '
    const next = padded.join('').replace(/ /g, '')
    onChange(next)
    if (cleaned && i < 5) refs.current[i + 1]?.focus()
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
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(t)
    refs.current[Math.min(t.length, 5)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={onPaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={disabled}
          value={chars[i]?.trim() ? chars[i] : ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            'w-12 h-14 sm:w-12 rounded-md border text-center text-2xl outline-none transition-colors disabled:opacity-50',
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
