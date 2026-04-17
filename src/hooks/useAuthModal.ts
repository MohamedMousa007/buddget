'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError, isValidEmailFormat } from '@/components/auth/authErrors'
import { useAuth } from '@/components/auth/auth-context'
import { useT } from '@/lib/i18n'
import { APP_CONFIG } from '@/lib/config'
import { routeAfterAuth } from '@/lib/auth/postAuthRedirect'
import { MIN_PASSWORD_LEN } from '@/components/features/auth-modal/authModalTokens'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isPlanStageComplete } from '@/lib/onboarding/onboardingStages'
import { markSessionEphemeral } from '@/hooks/useEphemeralSessionGuard'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type AuthFormMode = 'signin' | 'signup'
export type AuthStep = 'form' | 'verify' | 'forgot'
/**
 * 'signup' — verifying the email-confirmation OTP right after creating the account.
 * '2fa'    — verifying the email-OTP challenge that gates sign-in on a new device.
 */
export type AuthVerifyPurpose = 'signup' | '2fa'

/**
 * Supabase email/password + OTP + forgot-password flow for the global auth modal.
 */
export function useAuthModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    pendingNext,
    setPendingNext,
    closeAuthModal,
    authModalMessage,
    authModalInitialMode,
  } = useAuth()
  const t = useT()
  const supabase = useMemo(() => createClient(), [])

  const nextFromUrl = searchParams.get('next')
  useEffect(() => {
    if (nextFromUrl && nextFromUrl.startsWith('/') && !nextFromUrl.startsWith('//')) {
      setPendingNext(nextFromUrl)
    }
  }, [nextFromUrl, setPendingNext])

  const safeNext = useMemo(() => {
    const n = pendingNext || nextFromUrl || '/'
    return n.startsWith('/') && !n.startsWith('//') ? n : '/'
  }, [pendingNext, nextFromUrl])

  // Seeded on first mount from the caller-provided initial mode (e.g. the top-bar
  // "Sign up" button passes 'signup'). The modal re-mounts on every open, so this
  // picks up the latest `authModalInitialMode` without needing a sync effect.
  const [formMode, setFormMode] = useState<AuthFormMode>(authModalInitialMode)
  const [step, setStep] = useState<AuthStep>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [verifyPurpose, setVerifyPurpose] = useState<AuthVerifyPurpose>('signup')
  // Defaults to true — match the standard consumer-app expectation that users
  // stay signed in across browser restarts. When unchecked on sign-in we set
  // an ephemeral flag; `useEphemeralSessionGuard` will signOut on tab close.
  const [rememberMe, setRememberMe] = useState(true)
  /**
   * Result of the "is this email already registered?" lookup triggered on email
   * blur during sign-up. Drives the inline hint under the email field.
   * 'idle' — not checked yet (or signin mode); 'checking' — request in flight;
   * 'taken' — account exists, block submit; 'free' — safe to proceed.
   *
   * Stored alongside the email value that was checked so any subsequent edit
   * derives back to 'idle' without needing a setState-in-effect to reset.
   */
  const [emailCheck, setEmailCheck] = useState<{
    state: 'idle' | 'checking' | 'taken' | 'pending' | 'free' | 'missing' | 'exists'
    email: string
  }>({ state: 'idle', email: '' })
  const rawState = emailCheck.state
  const staleForCurrentEmail =
    rawState !== 'idle' &&
    rawState !== 'checking' &&
    emailCheck.email !== email.trim().toLowerCase()
  const emailCheckState: 'idle' | 'checking' | 'taken' | 'pending' | 'free' = staleForCurrentEmail
    ? 'idle'
    : rawState === 'missing' || rawState === 'exists'
      ? 'idle'
      : (rawState as 'idle' | 'checking' | 'taken' | 'pending' | 'free')
  const signinEmailCheckState: 'idle' | 'checking' | 'missing' | 'exists' = staleForCurrentEmail
    ? 'idle'
    : rawState === 'missing' || rawState === 'exists' || rawState === 'checking'
      ? (rawState as 'checking' | 'missing' | 'exists')
      : 'idle'

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [resendCooldown])

  const startResendCooldown = useCallback(() => setResendCooldown(60), [])

  /**
   * When a guest finishes their 6-step onboarding and then signs up, we flip
   * `user_metadata.onboarding_completed = true` via the service-role route so
   * middleware doesn't force them through the 27-step expert flow. Awaited so
   * the caller can refresh its session and `routeAfterAuth` sees the new
   * metadata before redirecting.
   */
  const promoteGuestIfNeeded = useCallback(
    async (client: SupabaseClient<Database>) => {
      // Post-promotion: if the user has just finished the 6-step guest
      // onboarding, flip their onboarding_completed metadata so middleware
      // doesn't force them through the 27-step expert flow. We check
      // `isPlanStageComplete` as the signal that the guest completed their
      // flow — if they jumped straight to signup without finishing it, they
      // still go through expert onboarding (haven't earned the skip).
      if (!isPlanStageComplete(useFinanceStore.getState().onboardingState)) return
      try {
        const res = await fetch('/api/auth/complete-guest-onboarding', { method: 'POST' })
        if (!res.ok) return
        // Refresh the session so the next `getUser()` returns the new metadata
        // and `routeAfterAuth` doesn't send us through expert onboarding.
        await client.auth.refreshSession()
      } catch (e) {
        console.error('[auth] promoteGuestIfNeeded failed', e)
      }
    },
    [],
  )

  /**
   * Fire an existence check when the email field loses focus in signup mode.
   * Cheap UX win: the user finds out the email is taken before they've filled
   * the rest of the form, and we don't pile up a big submit-time error.
   */
  const checkEmailOnBlur = useCallback(async () => {
    const trimmed = email.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || !isValidEmailFormat(trimmed)) {
      setEmailCheck({ state: 'idle', email: '' })
      return
    }
    setEmailCheck({ state: 'checking', email: key })
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      if (!res.ok) {
        // Rate-limit / server hiccup — drop back to idle so the submit path still gates.
        setEmailCheck({ state: 'idle', email: '' })
        return
      }
      const body = (await res.json()) as { exists?: boolean; verified?: boolean }
      if (formMode === 'signup') {
        const nextState: 'taken' | 'pending' | 'free' = body.exists
          ? body.verified
            ? 'taken'
            : 'pending'
          : 'free'
        setEmailCheck({ state: nextState, email: key })
      } else {
        // Sign-in mode: flag "no account for this email" so we can offer to
        // switch to signup, or confirm "account exists" for a gentle valid tone.
        setEmailCheck({ state: body.exists ? 'exists' : 'missing', email: key })
      }
    } catch {
      setEmailCheck({ state: 'idle', email: '' })
    }
  }, [email, formMode])

  const validateEmailField = useCallback(() => {
    if (!email.trim()) {
      setError(t.auth.errorEmailInvalid)
      return false
    }
    if (!isValidEmailFormat(email)) {
      setError(t.auth.errorEmailInvalid)
      return false
    }
    return true
  }, [email, t])

  const signIn = useCallback(async () => {
    setError('')
    if (!validateEmailField()) return
    if (!password) {
      setError(t.auth.errorMissingPassword)
      return
    }
    setLoading(true)
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (e) {
      setLoading(false)
      setError(mapAuthError(e, 'signin', t))
      return
    }
    // Flag the session as ephemeral so the pagehide guard signs out on tab close.
    markSessionEphemeral(!rememberMe)

    // Password is correct. If the user has email 2FA on and this browser isn't
    // a trusted device, we sign them back out and force an email OTP challenge.
    // Trusted devices / 2FA-off users continue straight into the app.
    try {
      const deviceRes = await fetch('/api/auth/device/check', { method: 'POST' })
      if (deviceRes.ok) {
        const body = (await deviceRes.json()) as { required?: boolean }
        if (body.required === true) {
          // Sign out the password session so nothing mounts before OTP completes.
          await supabase.auth.signOut()
          const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: false },
          })
          setLoading(false)
          if (otpErr) {
            setError(mapAuthError(otpErr, 'resend', t))
            return
          }
          setVerifyPurpose('2fa')
          setStep('verify')
          setOtp('')
          startResendCooldown()
          return
        }
      }
    } catch {
      // Device-check failure shouldn't lock the user out — fall through to the
      // normal signed-in redirect. If 2FA is on the next sign-in will try again.
    }

    await promoteGuestIfNeeded(supabase)
    setLoading(false)
    const { data: userData } = await supabase.auth.getUser()
    router.refresh()
    router.replace(routeAfterAuth(userData.user, safeNext))
  }, [email, password, promoteGuestIfNeeded, rememberMe, router, safeNext, startResendCooldown, supabase, t, validateEmailField])

  const signUp = useCallback(async () => {
    setError('')
    if (!validateEmailField()) return
    if (password.length < MIN_PASSWORD_LEN) {
      setError(t.auth.errorPasswordShort)
      return
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(t.auth.errorPasswordWeakComposition)
      return
    }
    if (password !== confirmPassword) {
      setError(t.auth.errorPasswordMismatch)
      return
    }
    // If the onBlur check already flagged this email, bail immediately — the
    // inline hint is showing, no need to surface another alert.
    if (emailCheckState === 'taken' || emailCheckState === 'pending') {
      return
    }
    setLoading(true)
    // Defence-in-depth: user may have submitted before the onBlur check fired
    // (e.g. Enter in the confirm field). Re-run the lookup inline.
    if (emailCheckState !== 'free') {
      try {
        const res = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        if (res.ok) {
          const body = (await res.json()) as { exists?: boolean; verified?: boolean }
          if (body.exists === true) {
            setLoading(false)
            setEmailCheck({
              state: body.verified ? 'taken' : 'pending',
              email: email.trim().toLowerCase(),
            })
            return
          }
        }
        // Rate-limit / network error: fall through; Supabase will still block.
      } catch {
        // ignore — Supabase remains the source of truth
      }
    }
    // If the current session is anonymous, promote it in-place via
    // `updateUser({ email, password })`. Same user_id, all RLS-scoped data
    // preserved. Supabase sends an OTP to the email; verifySignupOtp below
    // handles the `type: 'email_change'` path.
    const { data: currentUserData } = await supabase.auth.getUser()
    const isAnonPromotion = currentUserData.user?.is_anonymous === true

    if (isAnonPromotion) {
      const { error: updateErr } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
      })
      setLoading(false)
      if (updateErr) {
        setError(mapAuthError(updateErr, 'signup', t))
        return
      }
      setVerifyPurpose('signup')
      setStep('verify')
      setOtp('')
      startResendCooldown()
      return
    }

    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: undefined,
      },
    })
    setLoading(false)
    if (e) {
      const mapped = mapAuthError(e, 'signup', t)
      if (mapped === 'EMAIL_EXISTS') {
        // Route duplicate-email feedback through the same inline hint as the
        // onBlur check — one canonical place for that message.
        setEmailCheck({ state: 'taken', email: email.trim().toLowerCase() })
        return
      }
      setError(mapped)
      return
    }
    if (data.session) {
      await promoteGuestIfNeeded(supabase)
      const { data: userData } = await supabase.auth.getUser()
      router.refresh()
      router.replace(routeAfterAuth(userData.user, safeNext))
      return
    }
    if (data.user) {
      setVerifyPurpose('signup')
      setStep('verify')
      setOtp('')
      startResendCooldown()
      return
    }
    setError(t.auth.errorSignUpGeneric)
  }, [confirmPassword, email, emailCheckState, password, promoteGuestIfNeeded, router, safeNext, startResendCooldown, supabase, t, validateEmailField])

  const verifySignupOtp = useCallback(async () => {
    setError('')
    const token = otp.replace(/\D/g, '').slice(0, 6)
    if (token.length !== 6) {
      setError(t.auth.errorOtpIncomplete)
      return
    }
    setLoading(true)
    // Dispatch by purpose:
    //   - 'signup' when a brand-new user was created via supabase.auth.signUp
    //   - 'email_change' when an anonymous user set their email via updateUser
    //   - '2fa' (email) when challenging an existing account on a new device
    const { data: currentUserData } = await supabase.auth.getUser()
    const isAnonPromotion =
      verifyPurpose === 'signup' && currentUserData.user?.is_anonymous === true
    const otpType: 'signup' | 'email' | 'email_change' = isAnonPromotion
      ? 'email_change'
      : verifyPurpose === 'signup'
        ? 'signup'
        : 'email'
    const { error: e } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: otpType,
    })
    if (e) {
      setLoading(false)
      setError(mapAuthError(e, 'otp', t))
      return
    }
    // The browser has now proven it controls the email — trust it so future
    // sign-ins skip the OTP gate.
    try {
      await fetch('/api/auth/device/trust', { method: 'POST' })
    } catch {
      // Non-fatal: worst case we re-prompt next login.
    }
    // Skip expert onboarding when this verification completes a guest→signup.
    await promoteGuestIfNeeded(supabase)
    setLoading(false)
    const { data: userData } = await supabase.auth.getUser()
    router.refresh()
    router.replace(routeAfterAuth(userData.user, safeNext))
  }, [email, otp, promoteGuestIfNeeded, router, safeNext, supabase, t, verifyPurpose])

  const resendCode = useCallback(async () => {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    // Three reissue paths depending on what the pending OTP is for:
    //   - Anonymous promotion (email_change): re-call updateUser to re-send.
    //   - Brand-new signup: supabase.auth.resend with type='signup'.
    //   - 2FA challenge: reuse signInWithOtp (no native resend for sign-in OTP).
    const { data: currentUserData } = await supabase.auth.getUser()
    const isAnonPromotion =
      verifyPurpose === 'signup' && currentUserData.user?.is_anonymous === true
    const { error: e } = isAnonPromotion
      ? await supabase.auth.updateUser({ email: email.trim() })
      : verifyPurpose === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email: email.trim() })
        : await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: false },
          })
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'resend', t))
      return
    }
    startResendCooldown()
  }, [email, resendCooldown, startResendCooldown, supabase, t, verifyPurpose])

  const sendForgot = useCallback(async () => {
    setError('')
    if (!validateEmailField()) return
    setLoading(true)

    // First: does an account exist for this email? If not, tell the user.
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.ok) {
        const body = (await res.json()) as { exists?: boolean }
        if (body.exists === false) {
          setLoading(false)
          setError(t.auth.errorNoAccountForEmail)
          return
        }
      }
    } catch {
      // fall through and let Supabase handle the send
    }

    const origin =
      typeof window !== 'undefined' ? window.location.origin : APP_CONFIG.url.replace(/\/$/, '')
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/reset-password/confirm`,
    })
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'forgot', t))
      return
    }
    setForgotSuccess(true)
  }, [email, supabase, t, validateEmailField])

  const switchToSignIn = useCallback(() => {
    setFormMode('signin')
    setError('')
    setStep('form')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthModal()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [closeAuthModal])

  return {
    closeAuthModal,
    authModalMessage,
    formMode,
    setFormMode,
    step,
    setStep,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    otp,
    setOtp,
    loading,
    error,
    setError,
    forgotSuccess,
    setForgotSuccess,
    resendCooldown,
    verifyPurpose,
    emailCheckState,
    signinEmailCheckState,
    checkEmailOnBlur,
    rememberMe,
    setRememberMe,
    // Animate only between auth steps (form ↔ verify ↔ forgot). The sign-in/sign-up
    // toggle is handled inside the form via conditional rendering, so including
    // formMode here would remount the whole form on every tab click.
    contentKey: step,
    signIn,
    signUp,
    verifySignupOtp,
    resendCode,
    sendForgot,
    switchToSignIn,
  }
}
