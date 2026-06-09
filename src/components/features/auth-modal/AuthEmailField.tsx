'use client'

import { forwardRef, type KeyboardEvent } from 'react'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  inputClass,
  inputFocus,
  inputFocusError,
  inputFocusValid,
  inputStyle,
} from '@/components/features/auth-modal/authModalTokens'
import { useT } from '@/lib/i18n'

export type EmailFieldTone = 'neutral' | 'error' | 'valid'

function toneClass(tone: EmailFieldTone): string {
  if (tone === 'error') return inputFocusError
  if (tone === 'valid') return inputFocusValid
  return inputFocus
}

export interface AuthEmailFieldProps {
  value: string
  onChange: (v: string) => void
  /** Fired when the user explicitly advances (Enter key, arrow-tap, or form submit). */
  onAdvance: () => void
  disabled?: boolean
  pending?: boolean
  tone?: EmailFieldTone
  /** When present, renders the arrow button inside the input for one-tap advance. */
  showAdvanceButton?: boolean
}

/**
 * Dedicated email input for the morph form. Owns its own Enter-to-advance
 * behaviour and the optional trailing arrow button. Password-manager friendly:
 * carries `autocomplete="username webauthn"` + `type="email"` so Safari /
 * 1Password / Chrome Autofill all recognise the form.
 */
export const AuthEmailField = forwardRef<HTMLInputElement, AuthEmailFieldProps>(
  function AuthEmailField(
    { value, onChange, onAdvance, disabled, pending, tone = 'neutral', showAdvanceButton = true },
    ref,
  ) {
    const t = useT()

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!disabled && !pending) onAdvance()
      }
    }

    return (
      <div>
        <label className="text-[11px] text-[var(--color-brand-text-muted)] mb-0.5 block">
          {t.auth.labelEmail}
        </label>
        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            ref={ref}
            type="email"
            name="email"
            dir="ltr"
            autoComplete="username webauthn"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || pending}
            className={cn(inputClass, toneClass(tone), 'ps-10', showAdvanceButton ? 'pe-10' : 'pe-3')}
            style={inputStyle}
            placeholder={t.auth.placeholderEmail}
            aria-label={t.auth.labelEmail}
          />
          {showAdvanceButton ? (
            <button
              type="button"
              onClick={() => {
                if (!disabled && !pending) onAdvance()
              }}
              disabled={disabled || pending || !value.trim()}
              className="absolute end-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--color-brand-red)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-brand-red-hover)] transition-colors"
              aria-label={t.auth.continueAriaLabel}
            >
              {pending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
      </div>
    )
  },
)
