'use client'

import { forwardRef, useId, useState, type KeyboardEvent } from 'react'
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
  /** "current-password" for signin, "new-password" for signup. */
  autoComplete: 'current-password' | 'new-password'
  /** Form-field name so password managers pair it with the username. */
  name?: string
  tone?: PasswordFieldTone
  disabled?: boolean
  placeholder?: string
  /** Label bottom margin; defaults to the morph form's tight spacing. */
  labelClassName?: string
}

/**
 * Standalone password input with show/hide toggle. Used in the morph form's
 * State 2 (password entry).
 */
export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField(
    { value, onChange, onSubmit, label, autoComplete, name, tone = 'neutral', disabled, placeholder, labelClassName = 'mb-0.5' },
    ref,
  ) {
    const t = useT()
    const [show, setShow] = useState(false)
    const inputId = useId()

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!disabled) onSubmit()
      }
    }

    return (
      <div>
        <label htmlFor={inputId} className={cn('text-xs text-[var(--color-brand-text-muted)] block', labelClassName)}>
          {label}
        </label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            ref={ref}
            id={inputId}
            aria-invalid={tone === 'error' || undefined}
            type={show ? 'text' : 'password'}
            dir="ltr"
            name={name}
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
