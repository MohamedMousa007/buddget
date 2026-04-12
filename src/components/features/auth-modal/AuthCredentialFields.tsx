'use client'

import { Lock, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass, inputFocus, inputStyle } from '@/components/features/auth-modal/authModalTokens'
import { useT } from '@/lib/i18n'
import type { AuthFormMode } from '@/hooks/useAuthModal'

export interface AuthCredentialFieldsProps {
  formMode: AuthFormMode
  email: string
  password: string
  confirmPassword: string
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onConfirmPasswordChange: (v: string) => void
  onForgotClick: () => void
  onSubmitPrimary: () => void
}

/**
 * Email, password, optional confirm, and forgot link for sign-in/up form step.
 */
export function AuthCredentialFields({
  formMode,
  email,
  password,
  confirmPassword,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onForgotClick,
  onSubmitPrimary,
}: AuthCredentialFieldsProps) {
  const t = useT()
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.labelEmail}</label>
        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={cn(inputClass, inputFocus, 'ps-10')}
            style={inputStyle}
            placeholder={t.auth.placeholderEmail}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.labelPassword}</label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
            className={cn(inputClass, inputFocus, 'ps-10')}
            style={inputStyle}
            placeholder={t.auth.placeholderPassword}
          />
        </div>
        {formMode === 'signin' ? (
          <button type="button" onClick={onForgotClick} className="mt-2 text-xs text-[var(--color-brand-red)] hover:underline">
            {t.auth.forgotPassword}
          </button>
        ) : null}
      </div>
      {formMode === 'signup' ? (
        <div>
          <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.labelConfirm}</label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
              className={cn(inputClass, inputFocus, 'ps-10')}
              style={inputStyle}
              placeholder={t.auth.placeholderConfirm}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
