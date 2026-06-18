'use client'

import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import {
  inputClass,
  inputFocus,
  inputFocusError,
  inputFocusValid,
  inputStyle,
  MIN_PASSWORD_LEN,
} from '@/components/features/auth-modal/authModalTokens'
import { PasswordStrengthMeter } from '@/components/features/auth-modal/PasswordStrengthMeter'
import { PasswordVisibilityToggle } from '@/components/features/auth-modal/PasswordVisibilityToggle'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'

type Tone = 'neutral' | 'valid' | 'error'

function toneClass(tone: Tone): string {
  if (tone === 'error') return inputFocusError
  if (tone === 'valid') return inputFocusValid
  return inputFocus
}

export interface AuthResetPasswordStepProps {
  loading: boolean
  error: string
  setError: (v: string) => void
  onSubmit: (newPassword: string) => void
}

/**
 * Final step of the in-app password reset: enter + confirm a new password
 * (recovery-scoped session already established by the OTP step). Mirrors the
 * signup password bar (≥ MIN_PASSWORD_LEN, at least one letter and one number).
 */
export function AuthResetPasswordStep({ loading, error, setError, onSubmit }: AuthResetPasswordStepProps) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passwordPasses =
    password.length >= MIN_PASSWORD_LEN && /[A-Za-z]/.test(password) && /\d/.test(password)
  const passwordTone: Tone = password.length > 0 && passwordPasses ? 'valid' : 'neutral'
  const confirmTone: Tone =
    confirm.length > 0 && password.length > 0 ? (confirm === password ? 'valid' : 'error') : 'neutral'

  const submit = () => {
    if (password.length < MIN_PASSWORD_LEN) {
      setError(t.resetPassword.errorMinLength(MIN_PASSWORD_LEN))
      return
    }
    if (!passwordPasses) {
      setError(t.resetPassword.errorWeakPassword)
      return
    }
    if (password !== confirm) {
      setError(t.resetPassword.errorMismatch)
      return
    }
    onSubmit(password)
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.resetPassword.title}</h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">{t.resetPassword.subtitle}</p>
      </div>

      <div>
        <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.resetPassword.labelNew}</label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            type={showNew ? 'text' : 'password'}
            dir="ltr"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.resetPassword.placeholderNew}
            className={cn(inputClass, toneClass(passwordTone), 'ps-10 pe-10')}
            style={inputStyle}
          />
          <PasswordVisibilityToggle
            visible={showNew}
            onToggle={() => setShowNew((v) => !v)}
            label={showNew ? t.auth.hidePassword : t.auth.showPassword}
          />
        </div>
        <PasswordStrengthMeter password={password} />
      </div>

      <div>
        <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.resetPassword.labelConfirm}</label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            type={showConfirm ? 'text' : 'password'}
            dir="ltr"
            name="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t.resetPassword.placeholderConfirm}
            className={cn(inputClass, toneClass(confirmTone), 'ps-10 pe-10')}
            style={inputStyle}
            aria-invalid={confirmTone === 'error'}
          />
          <PasswordVisibilityToggle
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            label={showConfirm ? t.auth.hidePassword : t.auth.showPassword}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--color-brand-red)]">{error}</p> : null}

      <AuthPrimaryButton type="submit" disabled={loading}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.resetPassword.buttonSubmit}
      </AuthPrimaryButton>
    </form>
  )
}
