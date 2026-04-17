'use client'

import { Loader2 } from 'lucide-react'
import { AuthModeToggle } from '@/components/features/auth-modal/AuthModeToggle'
import { AuthCredentialFields } from '@/components/features/auth-modal/AuthCredentialFields'
import { AuthFormErrorAlert } from '@/components/features/auth-modal/AuthFormErrorAlert'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'
import { useT } from '@/lib/i18n'
import type { AuthFormMode } from '@/hooks/useAuthModal'

export interface AuthSignInUpStepProps {
  formMode: AuthFormMode
  setFormMode: (m: AuthFormMode) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  error: string
  setError: (v: string) => void
  loading: boolean
  setStep: (s: 'form' | 'verify' | 'forgot') => void
  setForgotSuccess: (v: boolean) => void
  signIn: () => Promise<void>
  signUp: () => Promise<void>
  resendCode: () => Promise<void>
  switchToSignIn: () => void
  emailCheckState: 'idle' | 'checking' | 'taken' | 'pending' | 'free'
  checkEmailOnBlur: () => void
  onResendPendingCode: () => void
}

/**
 * Combined sign-in / sign-up form with mode toggle and footer link.
 */
export function AuthSignInUpStep({
  formMode,
  setFormMode,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  setError,
  loading,
  setStep,
  setForgotSuccess,
  signIn,
  signUp,
  resendCode,
  switchToSignIn,
  emailCheckState,
  checkEmailOnBlur,
  onResendPendingCode,
}: AuthSignInUpStepProps) {
  const t = useT()
  const submit = () => void (formMode === 'signin' ? signIn() : signUp())

  return (
    <div className="space-y-4">
      <AuthModeToggle
        formMode={formMode}
        onModeChange={setFormMode}
        onClearError={() => setError('')}
      />

      <AuthCredentialFields
        formMode={formMode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onForgotClick={() => {
          setStep('forgot')
          setForgotSuccess(false)
          setError('')
        }}
        onSubmitPrimary={submit}
        onEmailBlur={checkEmailOnBlur}
        emailCheckState={emailCheckState}
        onSwitchToSignIn={() => {
          switchToSignIn()
          setError('')
        }}
        onResendPendingCode={onResendPendingCode}
      />

      <AuthFormErrorAlert
        error={error}
        onSignInInstead={() => {
          switchToSignIn()
          setError('')
        }}
        onResendCode={resendCode}
      />

      <AuthPrimaryButton disabled={loading} onClick={submit}>
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{formMode === 'signin' ? t.auth.loadingSignIn : t.auth.loadingSignUp}</span>
          </>
        ) : formMode === 'signin' ? (
          t.auth.submitSignIn
        ) : (
          t.auth.submitSignUp
        )}
      </AuthPrimaryButton>

      <p className="text-center text-sm text-[var(--color-brand-text-muted)]">
        {formMode === 'signin' ? (
          <button
            type="button"
            className="text-[var(--color-brand-red)] font-medium hover:underline"
            onClick={() => {
              setFormMode('signup')
              setError('')
            }}
          >
            {t.auth.footerNewHere}
          </button>
        ) : (
          <button
            type="button"
            className="text-[var(--color-brand-red)] font-medium hover:underline"
            onClick={() => {
              setFormMode('signin')
              setError('')
            }}
          >
            {t.auth.footerAlreadyHave}
          </button>
        )}
      </p>
    </div>
  )
}
