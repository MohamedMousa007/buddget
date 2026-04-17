'use client'

import { useState } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass, inputFocus, inputStyle } from '@/components/features/auth-modal/authModalTokens'
import { PasswordStrengthMeter } from '@/components/features/auth-modal/PasswordStrengthMeter'
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
  /** Signup-only: fired when the email field loses focus so we can pre-check registration. */
  onEmailBlur?: () => void
  /** Signup-only: lookup state from useAuthModal — surfaces an inline hint under the email. */
  emailCheckState?: 'idle' | 'checking' | 'taken' | 'free'
  /** Signup-only: CTA that flips the form to sign-in when the email is already registered. */
  onSwitchToSignIn?: () => void
}

/** Eye-toggle button positioned at the end edge of a password input. */
function PasswordVisibilityToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean
  onToggle: () => void
  label: string
}) {
  const Icon = visible ? EyeOff : Eye
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors p-1 -m-1"
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

/**
 * Email, password, optional confirm, forgot link, and inline email-taken hint.
 * Password visibility toggles (eye icons) are local state so the parent hook
 * doesn't need to care about them.
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
  onEmailBlur,
  emailCheckState = 'idle',
  onSwitchToSignIn,
}: AuthCredentialFieldsProps) {
  const t = useT()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const isSignup = formMode === 'signup'

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
            onBlur={() => onEmailBlur?.()}
            className={cn(inputClass, inputFocus, 'ps-10')}
            style={inputStyle}
            placeholder={t.auth.placeholderEmail}
            aria-invalid={isSignup && emailCheckState === 'taken'}
            aria-describedby={isSignup && emailCheckState === 'taken' ? 'signup-email-taken' : undefined}
          />
        </div>
        {isSignup && emailCheckState === 'checking' ? (
          <p className="mt-1.5 text-[11px] text-[var(--color-brand-text-muted)] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
            {t.auth.emailCheckInFlight}
          </p>
        ) : null}
        {isSignup && emailCheckState === 'taken' ? (
          <p
            id="signup-email-taken"
            className="mt-1.5 text-[12px] text-[var(--color-brand-red)] flex items-start gap-1.5"
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>
              {t.auth.emailAlreadyRegistered}
              {onSwitchToSignIn ? (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onSwitchToSignIn}
                    className="underline font-medium hover:no-underline"
                  >
                    {t.auth.signInInstead}
                  </button>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
      <div>
        <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.labelPassword}</label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
            className={cn(inputClass, inputFocus, 'ps-10 pe-10')}
            style={inputStyle}
            placeholder={t.auth.placeholderPassword}
          />
          <PasswordVisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
          />
        </div>
        {formMode === 'signin' ? (
          <button type="button" onClick={onForgotClick} className="mt-2 text-xs text-[var(--color-brand-red)] hover:underline">
            {t.auth.forgotPassword}
          </button>
        ) : (
          <PasswordStrengthMeter password={password} />
        )}
      </div>
      {isSignup ? (
        <div>
          <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.labelConfirm}</label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
              className={cn(inputClass, inputFocus, 'ps-10 pe-10')}
              style={inputStyle}
              placeholder={t.auth.placeholderConfirm}
            />
            <PasswordVisibilityToggle
              visible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              label={showConfirm ? t.auth.hidePassword : t.auth.showPassword}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
