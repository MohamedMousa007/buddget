'use client'

import { forwardRef, useState, type KeyboardEvent } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  inputClass,
  inputFocus,
  inputFocusError,
  inputFocusValid,
  inputStyle,
} from '@/components/features/auth-modal/authModalTokens'
import { PasswordVisibilityToggle } from '@/components/features/auth-modal/PasswordVisibilityToggle'
import { useT } from '@/lib/i18n'

export type PasswordFieldTone = 'neutral' | 'error' | 'valid'

function toneClass(tone: PasswordFieldTone): string {
  if (tone === 'error') return inputFocusError
  if (tone === 'valid') return inputFocusValid
  return inputFocus
}

export interface AuthPasswordFieldProps {
  value: string
  onChange: (v: string) => void
  /** Enter key submit handler. */
  onSubmit: () => void
  label: string
  /** Either "new-password webauthn" for signup or "current-password webauthn" for signin. */
  autoComplete: 'current-password webauthn' | 'new-password webauthn'
  tone?: PasswordFieldTone
  disabled?: boolean
  placeholder?: string
}

/**
 * Standalone password input with show/hide toggle. Used in the morph form's
 * State 2 (password entry). Always carries `webauthn` so passkey autofill is
 * offered on supporting browsers.
 */
export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField(
    { value, onChange, onSubmit, label, autoComplete, tone = 'neutral', disabled, placeholder },
    ref,
  ) {
    const t = useT()
    const [show, setShow] = useState(false)

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!disabled) onSubmit()
      }
    }

    return (
      <div>
        <label className="text-[11px] text-[var(--color-brand-text-muted)] mb-0.5 block">
          {label}
        </label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            ref={ref}
            type={show ? 'text' : 'password'}
            dir="ltr"
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(inputClass, toneClass(tone), 'ps-10 pe-10')}
            style={inputStyle}
            placeholder={placeholder ?? t.auth.placeholderPassword}
          />
          <PasswordVisibilityToggle
            visible={show}
            onToggle={() => setShow((v) => !v)}
            label={show ? t.auth.hidePassword : t.auth.showPassword}
          />
        </div>
      </div>
    )
  },
)
