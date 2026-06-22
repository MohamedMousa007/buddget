'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { mapAuthError, mapOAuthCallbackReason, mapOAuthError, isValidEmailFormat } from '@/components/auth/authErrors'
import { useAuth } from '@/components/auth/auth-context'
import { useT } from '@/lib/i18n'
import { apiFetch, apiFetchAuth } from '@/lib/apiBase'
import { routeAfterAuth, navigateAfterAuth } from '@/lib/auth/postAuthRedirect'
import { isNative } from '@/lib/native/isNative'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { MIN_PASSWORD_LEN } from '@/components/features/auth-modal/authModalTokens'
import { markSessionEphemeral } from '@/hooks/useEphemeralSessionGuard'
import { AUTH_EVENTS, track } from '@/lib/analytics/events'

export type AuthStep = 'form' | 'verify' | 'forgot' | 'reset-new-password'
/**
 * 'signup'   — verifying the email-confirmation OTP right after creating the account.
 * '2fa'      — verifying the email-OTP challenge that gates sign-in on a new device.
 * 'recovery' — verifying the 6-digit password-reset code, fully in-app (no link).
 */
export type AuthVerifyPurpose = 'signup' | '2fa' | 'recovery'

/**
 * Morph-form state machine:
 *   'collect'         — user typing their email; no password field visible.
 *   'password'        — email resolved; show password for signin OR signup.
 *   'verify-pending'  — email resolved as "exists but unverified"; next render
 *                       transitions into the shared verify step via setStep('verify').
 */
export type AuthEmailStep = 'collect' | 'password' | 'verify-pending'

/** Narrow state describing whether the resolved email is a new or existing user. */
export type AuthPasswordIntent = 'signin' | 'signup'

interface CachedEmailResult {
  exists: boolean
  verified: boolean
  at: number
}

const EMAIL_CACHE_TTL_MS = 10 * 60 * 1000 // 10 min

/**
 * Supabase email-first morph auth flow for the global auth modal.
 */
export function useAuthModal() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    pendingNext,
    setPendingNext,
    closeAuthModal,
    authModalMessage,
    authModalInitialStep,
  } = useAuth()
  const t = useT()
  const supabase = useMemo(
    () => (isSupabaseConfigured() ? createClient() : null),
    [],
  )

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

  const [step, setStep] = useState<AuthStep>(
    authModalInitialStep === 'forgot' ? 'forgot' : 'form',
  )
  /** Morph sub-step (only meaningful while `step === 'form'`). */
  const [emailStep, setEmailStep] = useState<AuthEmailStep>('collect')
  /** Derived by `advanceAfterEmail`: whether the resolved email belongs to an
   *  existing verified account ('signin') or is free to register ('signup'). */
  const [passwordIntent, setPasswordIntent] = useState<AuthPasswordIntent>('signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  /** Set while `/api/auth/check-email` is resolving. Disables the email input + advance button. */
  const [emailAdvancePending, setEmailAdvancePending] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [verifyPurpose, setVerifyPurpose] = useState<AuthVerifyPurpose>('signup')
  const [rememberMe, setRememberMe] = useState(true)

  /** In-flight check-email request; aborted on every new advance so stale responses can't overwrite newer ones. */
  const abortRef = useRef<AbortController | null>(null)
  /** Per-session cache of check-email results, keyed by lowercased+trimmed email. 10-min TTL. */
  const emailCacheRef = useRef<Map<string, CachedEmailResult>>(new Map())
  const oauthFailureHandled = useRef(false)

  useEffect(() => {
    if (oauthFailureHandled.current) return
    const errParam = searchParams.get('error')
    if (errParam !== 'oauth' && errParam !== 'auth') return
    oauthFailureHandled.current = true
    const reason = mapOAuthCallbackReason(searchParams.get('reason'))
    setError(mapOAuthError(null, reason, t))
    setEmailStep('collect')
    setStep('form')
    const qs = new URLSearchParams(searchParams.toString())
    qs.delete('error')
    qs.delete('reason')
    const q = qs.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
  }, [pathname, router, searchParams, t])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const startResendCooldown = useCallback(() => setResendCooldown(60), [])

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

  /**
   * Advance from State 1 (email collection) to the appropriate next state.
   * Fires `/api/auth/check-email`, applies the response, and transitions
   * `emailStep` accordingly. Uses the in-memory cache first to avoid re-hitting
   * the endpoint on typos + edits. Cancels any in-flight request via AbortController
   * so stale responses can't overwrite newer ones.
   */
  const advanceAfterEmail = useCallback(async () => {
    if (!validateEmailField()) return
    const trimmed = email.trim()
    const key = trimmed.toLowerCase()
    track(AUTH_EVENTS.emailSubmitted, { cached: emailCacheRef.current.has(key) })

    const applyResult = (exists: boolean, verified: boolean, cached: boolean) => {
      // TEMP diagnostic — surfaces in Android logcat under tag `Capacitor/Console`.
      console.info(`[MORPH] email="${key}" exists=${exists} verified=${verified} cached=${cached} → intent=${exists && verified ? 'signin' : exists ? 'verify-pending' : 'signup'}`)
      if (exists && verified) {
        setPasswordIntent('signin')
        setEmailStep('password')
        setError('')
        track(AUTH_EVENTS.emailStateResolved, { state: 'verified_exists', cached })
      } else if (exists && !verified) {
        setEmailStep('verify-pending')
        setError('')
        track(AUTH_EVENTS.emailStateResolved, { state: 'pending_verification', cached })
      } else {
        setPasswordIntent('signup')
        setEmailStep('password')
        setError('')
        track(AUTH_EVENTS.emailStateResolved, { state: 'free', cached })
      }
    }

    // Cache hit — skip network.
    const cached = emailCacheRef.current.get(key)
    if (cached && Date.now() - cached.at < EMAIL_CACHE_TTL_MS) {
      applyResult(cached.exists, cached.verified, true)
      return
    }

    // Cancel any prior in-flight request.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setEmailAdvancePending(true)

    // One check-email attempt. Returns the parsed result, or 'retry' for
    // transient failures (network / 5xx) worth another try, or 'giveup' for
    // aborts and non-retryable statuses (e.g. 429 — won't clear immediately).
    const attemptCheck = async (): Promise<
      { exists: boolean; verified: boolean } | 'retry' | 'giveup'
    > => {
      try {
        const res = await apiFetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
          signal: controller.signal,
        })
        if (controller.signal.aborted) return 'giveup'
        if (res.ok) {
          const body = (await res.json()) as { exists?: boolean; verified?: boolean }
          return { exists: !!body.exists, verified: !!body.verified }
        }
        return res.status >= 500 ? 'retry' : 'giveup'
      } catch (e) {
        if (controller.signal.aborted) return 'giveup'
        console.error('[auth] advanceAfterEmail fetch failed', e)
        return 'retry'
      }
    }

    try {
      let resolved: { exists: boolean; verified: boolean } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await attemptCheck()
        if (controller.signal.aborted) return
        if (r === 'giveup') break
        if (r === 'retry') {
          if (attempt < 2) await new Promise((res) => setTimeout(res, 300 * (attempt + 1)))
          continue
        }
        resolved = r
        break
      }

      if (resolved) {
        emailCacheRef.current.set(key, { ...resolved, at: Date.now() })
        applyResult(resolved.exists, resolved.verified, false)
      } else {
        // Inconclusive check (network/CORS/timeout/429). NEVER force an existing
        // user onto the create-account path — default to sign-in. A genuinely new
        // user can flip to "Create account" via the toggle on the password step.
        console.info(`[MORPH] email="${key}" inconclusive → intent=signin (fallback)`)
        track(AUTH_EVENTS.morphFallback, { reason: 'inconclusive' })
        setPasswordIntent('signin')
        setEmailStep('password')
        setError('')
      }
    } finally {
      if (abortRef.current === controller) {
        setEmailAdvancePending(false)
        abortRef.current = null
      }
    }
  }, [email, validateEmailField])

  /**
   * Go back from State 2 to State 1 (email collection). Resets password + error
   * + loading so nothing stale carries over. Email stays editable.
   */
  const backToEmail = useCallback(() => {
    track(AUTH_EVENTS.backToEmail)
    abortRef.current?.abort()
    abortRef.current = null
    setEmailAdvancePending(false)
    setEmailStep('collect')
    setPassword('')
    setError('')
    setLoading(false)
  }, [])

  /**
   * Abandon the pending-verification path (user typed the wrong email, wants
   * to try a different one). Routes back to State 1.
   */
  const abandonVerifyPending = useCallback(() => {
    setEmailStep('collect')
    setError('')
  }, [])

  /**
   * Accept the pending-verification path: kick off a fresh OTP email and jump
   * into the shared verify step.
   */
  const continueVerifyPending = useCallback(async () => {
    if (!supabase) {
      setError(t.auth.errorFallback)
      return
    }
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
      if (e) {
        setError(mapAuthError(e, 'resend', t))
        setLoading(false)
        return
      }
      setVerifyPurpose('signup')
      setStep('verify')
      setOtp('')
      startResendCooldown()
    } finally {
      setLoading(false)
    }
  }, [email, startResendCooldown, supabase, t])

  const signIn = useCallback(async () => {
    if (!supabase) {
      setError(t.auth.errorFallback)
      return
    }
    setError('')
    if (!validateEmailField()) return
    if (!password) {
      setError(t.auth.errorMissingPassword)
      return
    }
    setLoading(true)
    track(AUTH_EVENTS.passwordSubmitted, { intent: 'signin' })
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (e) {
      setLoading(false)
      setError(mapAuthError(e, 'signin', t))
      return
    }
    markSessionEphemeral(!rememberMe)

    // 2FA device-trust check.
    try {
      const deviceRes = await apiFetchAuth('/api/auth/device/check', { method: 'POST' })
      if (deviceRes.ok) {
        const body = (await deviceRes.json()) as { required?: boolean }
        if (body.required === true) {
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
      // Device-check failure shouldn't lock users out — proceed.
    }

    setLoading(false)
    const { data: userData } = await supabase.auth.getUser()
    // Skip router.refresh on native: there's no server to revalidate and it
    // desyncs the static-export App Router (navigateAfterAuth hard-loads anyway).
    if (!isNative()) router.refresh()
    navigateAfterAuth(router, routeAfterAuth(userData.user, safeNext, useFinanceStore.getState()))
  }, [
    email,
    password,
    rememberMe,
    router,
    safeNext,
    startResendCooldown,
    supabase,
    t,
    validateEmailField,
  ])

  const signUp = useCallback(async () => {
    if (!supabase) {
      setError(t.auth.errorFallback)
      return
    }
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
    setLoading(true)
    track(AUTH_EVENTS.passwordSubmitted, { intent: 'signup' })

    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: undefined },
    })
    setLoading(false)
    if (e) {
      const rawMsg = (e.message || '').toLowerCase()
      const isEmailSendError =
        rawMsg.includes('sending confirmation email') || rawMsg.includes('error sending')

      if (isEmailSendError && data.user) {
        // Supabase created the account but failed to deliver the confirmation
        // email (e.g. no SMTP configured, transient provider error).
        // Move to the verify step so the user can request a fresh code.
        setVerifyPurpose('signup')
        setStep('verify')
        setOtp('')
        startResendCooldown()
        return
      }

      const mapped = mapAuthError(e, 'signup', t)
      if (mapped === 'EMAIL_EXISTS') {
        // Supabase disagreed with our check-email result. Push the user back
        // to email collection so they can try signing in instead.
        setEmailStep('collect')
        setError(t.auth.errorAccountExists)
        // Cache the correction so they don't loop.
        emailCacheRef.current.set(email.trim().toLowerCase(), {
          exists: true,
          verified: true,
          at: Date.now(),
        })
        return
      }
      setError(mapped)
      return
    }
    if (data.session) {
      const { data: userData } = await supabase.auth.getUser()
      // Direct replace — no router.refresh() afterwards. The refresh
      // forces a full server revalidation that stalls the splash
      // transition for ~500-1000 ms on top of the natural navigation.
      // Server components on the new route pick up the fresh session
      // cookies at the next navigation/mount naturally.
      navigateAfterAuth(router, routeAfterAuth(userData.user, safeNext, useFinanceStore.getState()))
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
  }, [
    email,
    password,
    router,
    safeNext,
    startResendCooldown,
    supabase,
    t,
    validateEmailField,
  ])

  /**
   * Submit handler for State 2: dispatches to signIn or signUp based on
   * the resolved `passwordIntent`.
   */
  const submitPassword = useCallback(() => {
    if (passwordIntent === 'signin') void signIn()
    else void signUp()
  }, [passwordIntent, signIn, signUp])

  const verifyOtpCode = useCallback(async () => {
    if (!supabase) {
      setError(t.auth.errorFallback)
      return
    }
    setError('')
    const token = otp.replace(/\D/g, '').slice(0, 6)
    if (token.length !== 6) {
      setError(t.auth.errorOtpIncomplete)
      return
    }
    setLoading(true)
    // 'signup' → email confirmation; 'recovery' → password reset code;
    // '2fa' → email-OTP device challenge (Supabase type 'email').
    const otpType: 'signup' | 'recovery' | 'email' =
      verifyPurpose === 'signup' ? 'signup' : verifyPurpose === 'recovery' ? 'recovery' : 'email'
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
    // Recovery: the session now carries recovery scope — go set the new password
    // in-modal (do NOT trust the device or route to the dashboard yet).
    if (verifyPurpose === 'recovery') {
      setLoading(false)
      setOtp('')
      setStep('reset-new-password')
      return
    }
    // Device-trust is a signup/2FA concept only.
    try {
      await apiFetchAuth('/api/auth/device/trust', { method: 'POST' })
    } catch {
      /* non-fatal */
    }
    setLoading(false)
    const { data: userData } = await supabase.auth.getUser()
    // Skip router.refresh on native: there's no server to revalidate and it
    // desyncs the static-export App Router (navigateAfterAuth hard-loads anyway).
    if (!isNative()) router.refresh()
    navigateAfterAuth(router, routeAfterAuth(userData.user, safeNext, useFinanceStore.getState()))
  }, [email, otp, router, safeNext, supabase, t, verifyPurpose])

  /**
   * State 'reset-new-password': set the new password using the recovery-scoped
   * session established by `verifyOtpCode`. On success the user stays signed in
   * (smoother than the web link flow's sign-out-then-relogin).
   */
  const submitNewPassword = useCallback(
    async (newPassword: string) => {
      if (!supabase) {
        setError(t.auth.errorFallback)
        return
      }
      setError('')
      setLoading(true)
      const { error: e } = await supabase.auth.updateUser({ password: newPassword })
      if (e) {
        setLoading(false)
        const m = (e.message || '').toLowerCase()
        if (m.includes('same') && m.includes('password')) {
          setError(t.resetPassword.errorSamePassword)
          return
        }
        setError(mapAuthError(e, 'forgot', t))
        return
      }
      setLoading(false)
      const { data: userData } = await supabase.auth.getUser()
      if (!isNative()) router.refresh()
      navigateAfterAuth(router, routeAfterAuth(userData.user, safeNext, useFinanceStore.getState()))
    },
    [router, safeNext, supabase, t],
  )

  const resendCode = useCallback(async () => {
    if (!supabase) {
      setError(t.auth.errorFallback)
      return
    }
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    const { error: e } =
      verifyPurpose === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email: email.trim() })
        : verifyPurpose === 'recovery'
          ? await supabase.auth.resetPasswordForEmail(email.trim())
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
    if (!supabase) {
      setError(t.auth.errorFallback)
      return
    }
    setError('')
    if (!validateEmailField()) return
    setLoading(true)
    // No redirectTo → Supabase emails a 6-digit recovery code ({{ .Token }})
    // instead of a magic link, so the whole flow stays in-app (no browser).
    // We do NOT gate on /api/auth/check-email: resetPasswordForEmail returns
    // success regardless of whether the account exists, so always advancing to
    // the code step both closes the account-enumeration vector and simplifies
    // the path (a mistyped address simply never receives a code).
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim())
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'forgot', t))
      return
    }
    setVerifyPurpose('recovery')
    setOtp('')
    setStep('verify')
    startResendCooldown()
  }, [email, startResendCooldown, supabase, t, validateEmailField])

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

  // Cancel any in-flight check-email request on unmount.
  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    closeAuthModal,
    authModalMessage,
    // Morph state
    emailStep,
    passwordIntent,
    emailAdvancePending,
    advanceAfterEmail,
    backToEmail,
    abandonVerifyPending,
    continueVerifyPending,
    submitPassword,
    // Outer auth step
    step,
    setStep,
    // Fields
    email,
    setEmail,
    password,
    setPassword,
    otp,
    setOtp,
    loading,
    error,
    setError,
    resendCooldown,
    verifyPurpose,
    rememberMe,
    setRememberMe,
    // Step handlers (verify / forgot / reset)
    signIn,
    signUp,
    verifyOtpCode,
    submitNewPassword,
    resendCode,
    sendForgot,
    // Animation key
    contentKey: step,
  }
}
