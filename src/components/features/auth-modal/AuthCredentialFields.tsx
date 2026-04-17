'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { useT } from '@/lib/i18n'
import type { AuthFormMode } from '@/hooks/useAuthModal'

type ValidationTone = 'neutral' | 'valid' | 'error'

function toneClass(tone: ValidationTone): string {
  if (tone === 'error') return inputFocusError
  if (tone === 'valid') return inputFocusValid
  return inputFocus
}

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
  emailCheckState?: 'idle' | 'checking' | 'taken' | 'pending' | 'free'
  /** Signup-only: CTA shown alongside pending-verification hint that re-sends the code. */
  onResendPendingCode?: () => void
  /** Signup-only: CTA that flips the form to sign-in when the email is already registered. */
  onSwitchToSignIn?: () => void
  /** Sign-in-only: CTA that flips to signup when no account is found for the email. */
  onSwitchToSignUp?: () => void
  /**
   * Sign-in-only: email blur lookup state. Parallels `emailCheckState` but fires
   * even on sign-in mode so we can nudge "no account found — create one?".
   */
  signinEmailCheckState?: 'idle' | 'checking' | 'missing' | 'exists'
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
  onSwitchToSignUp,
  signinEmailCheckState = 'idle',
  onResendPendingCode,
}: AuthCredentialFieldsProps) {
  const t = useT()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const isSignup = formMode === 'signup'

  // Per-field validation tones. Only signup fields ever go non-neutral — on the
  // sign-in screen we can't tell what's "valid" without hitting the server, so
  // we keep everything neutral until the form is submitted.
  const passwordPassesRules =
    password.length >= MIN_PASSWORD_LEN && /[A-Za-z]/.test(password) && /\d/.test(password)
  const emailTone: ValidationTone = isSignup
    ? emailCheckState === 'taken' || emailCheckState === 'pending'
      ? 'error'
      : emailCheckState === 'free'
        ? 'valid'
        : 'neutral'
    : signinEmailCheckState === 'missing'
      ? 'error'
      : signinEmailCheckState === 'exists'
        ? 'valid'
        : 'neutral'
  const passwordTone: ValidationTone =
    isSignup && password.length > 0 && passwordPassesRules ? 'valid' : 'neutral'
  const confirmTone: ValidationTone =
    isSignup && confirmPassword.length > 0 && password.length > 0
      ? confirmPassword === password
        ? 'valid'
        : 'error'
      : 'neutral'

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">{t.auth.labelEmail}</label>
        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
          <input
            type="email"
            dir="ltr"
            autoComplete={isSignup ? 'email' : 'email'}
            inputMode="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={() => onEmailBlur?.()}
            className={cn(inputClass, toneClass(emailTone), 'ps-10')}
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
        {!isSignup && signinEmailCheckState === 'missing' ? (
          <p
            id="signin-no-account"
            className="mt-1.5 text-[12px] text-[var(--color-brand-amber)] flex items-start gap-1.5"
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>
              {t.auth.noAccountForEmail}
              {onSwitchToSignUp ? (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onSwitchToSignUp}
                    className="underline font-medium hover:no-underline"
                  >
                    {t.auth.createAccountInstead}
                  </button>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
        {isSignup && emailCheckState === 'pending' ? (
          <p
            id="signup-email-pending"
            className="mt-1.5 text-[12px] text-[var(--color-brand-amber)] flex items-start gap-1.5"
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>
              {t.auth.emailPendingVerification}
              {onResendPendingCode ? (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onResendPendingCode}
                    className="underline font-medium hover:no-underline"
                  >
                    {t.auth.resendCode}
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
            dir="ltr"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
            className={cn(inputClass, toneClass(passwordTone), 'ps-10 pe-10')}
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
              dir="ltr"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmitPrimary()}
              className={cn(inputClass, toneClass(confirmTone), 'ps-10 pe-10')}
              style={inputStyle}
              placeholder={t.auth.placeholderConfirm}
              aria-invalid={confirmTone === 'error'}
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
