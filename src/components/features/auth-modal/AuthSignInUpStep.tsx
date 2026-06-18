'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { AuthEmailField } from '@/components/features/auth-modal/AuthEmailField'
import { AuthPasswordField } from '@/components/features/auth-modal/AuthPasswordField'
import { AuthFormErrorAlert } from '@/components/features/auth-modal/AuthFormErrorAlert'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'
import { AuthOAuthButtons } from '@/components/features/auth-modal/AuthOAuthButtons'
import { PasswordStrengthMeter } from '@/components/features/auth-modal/PasswordStrengthMeter'
import { BiometricLoginButton } from '@/components/features/auth-modal/BiometricLoginButton'
import { useAuth } from '@/components/auth/auth-context'
import { useT } from '@/lib/i18n'
import type { AuthEmailStep, AuthPasswordIntent } from '@/hooks/useAuthModal'

export interface AuthSignInUpStepProps {
  emailStep: AuthEmailStep
  passwordIntent: AuthPasswordIntent
  emailAdvancePending: boolean
  advanceAfterEmail: () => void
  backToEmail: () => void
  abandonVerifyPending: () => void
  continueVerifyPending: () => void
  submitPassword: () => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  error: string
  setError: (v: string) => void
  loading: boolean
  onForgotClick: () => void
  resendCode: () => Promise<void>
  rememberMe: boolean
  setRememberMe: (v: boolean) => void
}

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 2) return `${local[0] ?? ''}***${domain}`
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}${domain}`
}

/**
 * Three-state morph auth form (email-first):
 *  - `emailStep === 'collect'`      — email input + OAuth buttons.
 *  - `emailStep === 'password'`     — password for the resolved email; intent
 *                                     (signin vs signup) comes from check-email.
 *  - `emailStep === 'verify-pending'` — existing unverified email; prompts the
 *                                       user to continue into the OTP step.
 */
export function AuthSignInUpStep({
  emailStep,
  passwordIntent,
  emailAdvancePending,
  advanceAfterEmail,
  backToEmail,
  abandonVerifyPending,
  continueVerifyPending,
  submitPassword,
  email,
  setEmail,
  password,
  setPassword,
  error,
  setError,
  loading,
  onForgotClick,
  resendCode,
  rememberMe,
  setRememberMe,
}: AuthSignInUpStepProps) {
  const t = useT()
  const { pendingNext } = useAuth()

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const submitBtnWrapRef = useRef<HTMLDivElement>(null)

  // Focus management on state transitions.
  useEffect(() => {
    if (emailStep === 'collect') emailRef.current?.focus()
    else if (emailStep === 'password') passwordRef.current?.focus()
  }, [emailStep])

  // iOS keyboard ergonomics: on small viewports when the password field gains
  // focus, scroll the submit button into view so it isn't hidden behind the
  // software keyboard.
  useEffect(() => {
    if (emailStep !== 'password') return
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      if (vv.height < 500) {
        submitBtnWrapRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [emailStep])

  const maskedEmail = maskEmail(email.trim())
  const isSignin = passwordIntent === 'signin'

  // Screen-reader announcement text for each state.
  const srAnnouncement =
    emailStep === 'password'
      ? isSignin
        ? t.auth.srEnterPasswordFor(maskedEmail)
        : t.auth.srCreateAccountFor(maskedEmail)
      : emailStep === 'verify-pending'
        ? t.auth.srFinishVerifying
        : ''

  return (
    <div role="region" aria-live="polite">
      <span className="sr-only">{srAnnouncement}</span>

      <AnimatePresence mode="wait" initial={false}>
        {emailStep === 'collect' ? (
          <motion.div
            key="collect"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-3"
          >
            <p className="text-center text-sm text-[var(--color-brand-text-secondary)]">
              {t.auth.morphTitle}
            </p>

            <BiometricLoginButton autoPrompt />

            <AuthOAuthButtons nextPath={pendingNext || '/'} />

            <div className="relative flex items-center gap-3">
              <span className="flex-1 h-px bg-[var(--color-brand-border)]" />
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
                {t.auth.orContinueWithEmail}
              </span>
              <span className="flex-1 h-px bg-[var(--color-brand-border)]" />
            </div>

            {/* Wrap email + hidden password in a single <form> so browsers /
                password managers recognise the sign-in pair and offer saved
                credentials when the email field is focused. When the user
                picks a saved login, both fields get filled at once; the
                password carries through via shared state so the password
                step is pre-populated after advance. */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!emailAdvancePending) advanceAfterEmail()
              }}
              className="space-y-3"
            >
              <AuthEmailField
                ref={emailRef}
                value={email}
                onChange={(v) => {
                  setEmail(v)
                  if (error) setError('')
                }}
                onAdvance={advanceAfterEmail}
                pending={emailAdvancePending}
                showAdvanceButton
              />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                tabIndex={-1}
                aria-hidden="true"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="absolute h-0 w-0 opacity-0 pointer-events-none"
              />
            </form>

            <AuthFormErrorAlert error={error} onResendCode={resendCode} />
          </motion.div>
        ) : emailStep === 'password' ? (
          <motion.div
            key="password"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-3"
          >
            <button
              type="button"
              onClick={backToEmail}
              className="-mt-1 -ms-1 flex items-center gap-1.5 text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] h-8 px-1 rounded-md"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden />
              <span>{t.auth.backToEmail}</span>
            </button>

            <p className="text-sm text-[var(--color-brand-text-primary)]">
              {isSignin
                ? t.auth.welcomeBack(maskedEmail)
                : t.auth.createAccountFor(maskedEmail)}
            </p>

            {/* Real <form> with a username + password pair so the OS/browser
                password manager autofills here and offers to SAVE on submit.
                The username is an off-screen controlled input (mirrors the
                collect step's hidden password) carrying the resolved email. */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!loading) submitPassword()
              }}
              className="space-y-3"
            >
              <input
                type="text"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute h-0 w-0 opacity-0 pointer-events-none"
              />

              <AuthPasswordField
                ref={passwordRef}
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (error) setError('')
                }}
                onSubmit={submitPassword}
                label={t.auth.labelPassword}
                name="password"
                autoComplete={isSignin ? 'current-password' : 'new-password'}
                disabled={loading}
              />

              {isSignin ? (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-brand-text-secondary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--color-brand-border)] accent-[var(--color-brand-red)]"
                    />
                    <span>{t.auth.rememberMe}</span>
                  </label>
                  <button
                    type="button"
                    onClick={onForgotClick}
                    className="text-xs text-[var(--color-brand-red)] hover:underline"
                  >
                    {t.auth.forgotPassword}
                  </button>
                </div>
              ) : (
                <PasswordStrengthMeter password={password} />
              )}

              <AuthFormErrorAlert error={error} onResendCode={resendCode} />

              <div ref={submitBtnWrapRef}>
                <AuthPrimaryButton type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isSignin ? t.auth.loadingSignIn : t.auth.loadingSignUp}</span>
                    </>
                  ) : isSignin ? (
                    t.auth.submitSignIn
                  ) : (
                    t.auth.submitSignUp
                  )}
                </AuthPrimaryButton>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="verify-pending"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-3"
          >
            <button
              type="button"
              onClick={abandonVerifyPending}
              className="-mt-1 -ms-1 flex items-center gap-1.5 text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] h-8 px-1 rounded-md"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden />
              <span>{t.auth.backToEmail}</span>
            </button>

            <p className="text-sm text-[var(--color-brand-text-primary)]">
              {t.auth.pendingVerificationTitle}
            </p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {t.auth.pendingVerificationHelp}
            </p>

            <AuthFormErrorAlert error={error} onResendCode={resendCode} />

            <AuthPrimaryButton disabled={loading} onClick={continueVerifyPending}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.auth.pendingContinueCta
              )}
            </AuthPrimaryButton>

            <button
              type="button"
              onClick={abandonVerifyPending}
              className="w-full text-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
            >
              {t.auth.pendingUseDifferentEmail}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

