'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { isNative } from '@/lib/native/isNative'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  SupabaseFinanceSync,
  flushFinanceNow,
  suspendFinanceSync,
} from '@/components/sync/SupabaseFinanceSync'
import { AnalyticsHeartbeat } from '@/components/sync/AnalyticsHeartbeat'
import { NativeBootstrap } from '@/lib/native/NativeBootstrap'
import { unregisterPushToken } from '@/lib/native/pushNotifications'
import { BiometricSessionPersist } from '@/lib/native/useBiometricSessionPersist'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthContext, type AuthContextValue, type AuthMode, useAuth } from '@/components/auth/auth-context'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { LandingGate } from '@/components/auth/LandingGate'
const WelcomeScreen = lazy(() =>
  import('@/components/auth/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen })),
)
import { useEphemeralSessionGuard } from '@/hooks/useEphemeralSessionGuard'
import { DialogProvider } from '@/components/ui/dialog/DialogProvider'

/**
 * Minimal centered splash rendered while the initial auth check is in flight.
 * Keeps the tree unmounted (no flicker of dashboard → landing for authed users
 * on reload) and matches the reset-password page's own loading treatment.
 */
function AuthLoadingSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-brand-bg)]">
      <div
        aria-label="Loading"
        className="w-8 h-8 border-2 border-[var(--color-brand-border)] border-t-[var(--color-brand-red)] rounded-full animate-spin"
      />
    </div>
  )
}

/**
 * After a successful password reset, `/reset-password/confirm` sets an
 * HttpOnly `buddget_password_updated` cookie (via POST /api/auth/password-updated)
 * and redirects to `/`. On the next mount we ask the server whether the cookie
 * is present; if so, open the sign-in modal with the success message and let
 * the server clear the cookie in the same GET. One-shot per reset.
 */
function PasswordUpdatedCookieSync() {
  const { openAuthModal } = useAuth()
  const t = useT()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    void (async () => {
      try {
        const { apiFetch } = await import('@/lib/apiBase')
        const res = await apiFetch('/api/auth/password-updated', { method: 'GET' })
        if (!res.ok) return
        const body = (await res.json()) as { pending?: boolean }
        if (body.pending === true) {
          openAuthModal('/', t.resetPassword.successSignInPrompt, 'signin')
        }
      } catch {
        /* silent — worst case the user just sees the landing without the toast */
      }
    })()
  }, [openAuthModal, t.resetPassword.successSignInPrompt])

  return null
}

/**
 * After an expired reset link, `/reset-password/confirm` redirects to
 * `/?requestReset=1`. We pick that up here and route the user straight to
 * the forgot-password step so they can request a new email without hunting.
 */
function RequestResetQuerySync() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const handled = useRef(false)
  const { openAuthModal } = useAuth()

  useEffect(() => {
    if (handled.current) return
    if (searchParams.get('requestReset') !== '1') return
    handled.current = true
    openAuthModal('/', null, 'signin', 'forgot')
    const qs = new URLSearchParams(searchParams.toString())
    qs.delete('requestReset')
    const q = qs.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
  }, [searchParams, pathname, router, openAuthModal])

  return null
}

/**
 * Supabase redirects to `/?error=auth#error=access_denied&error_code=otp_expired`
 * when the user clicks an expired password-reset link. Open the forgot-password
 * modal with an expiry message so they can request a fresh one.
 */
function AuthErrorQuerySync() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const handled = useRef(false)
  const { openAuthModal } = useAuth()
  const t = useT()

  useEffect(() => {
    if (handled.current) return
    if (searchParams.get('error') !== 'auth') return
    handled.current = true
    openAuthModal('/', t.resetPassword.errorLinkExpired, 'signin', 'forgot')
    const qs = new URLSearchParams(searchParams.toString())
    qs.delete('error')
    const q = qs.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
  }, [searchParams, pathname, router, openAuthModal, t])

  return null
}

/** Opens the auth modal when `?next=` is present (e.g. middleware redirect from /admin). */
function AuthNextQuerySync({ configured }: { configured: boolean }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, openAuthModal } = useAuth()
  const handled = useRef(false)

  useEffect(() => {
    if (!configured || loading || user || handled.current) return
    const next = searchParams.get('next')
    if (!next || !next.startsWith('/') || next.startsWith('//')) return
    handled.current = true
    openAuthModal(next)
    const qs = new URLSearchParams(searchParams.toString())
    qs.delete('next')
    const q = qs.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
  }, [configured, loading, user, searchParams, pathname, router, openAuthModal])

  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const dataReady = useFinanceStore((s) => s.dataReady)
  const [pendingNext, setPendingNext] = useState('/')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null)
  const [authModalInitialStep, setAuthModalInitialStep] = useState<'form' | 'forgot'>('form')
  // One-shot splash latch state — see the gate block below for semantics.
  // Declared here so the SIGNED_OUT handler and signOut() can reset it.
  const [splashDoneFor, setSplashDoneFor] = useState<string | null>(null)
  const [minElapsedFor, setMinElapsedFor] = useState<string | null>(null)
  const [dataPullTimedOut, setDataPullTimedOut] = useState(false)

  const configured = useMemo(() => isSupabaseConfigured(), [])

  // Tracks whether the auth modal is currently open so the onAuthStateChange
  // handler can distinguish "in-modal OTP recovery flow" from "magic link flow".
  const authModalOpenRef = useRef(false)
  useEffect(() => { authModalOpenRef.current = authModalOpen }, [authModalOpen])

  // Safety net: if getSession() never resolves (e.g. native token refresh hangs
  // on slow/no network), release the loading gate after 10 s so the user reaches
  // the landing screen instead of being stuck forever.
  useEffect(() => {
    if (!configured) return
    const id = globalThis.setTimeout(() => setLoading(false), 10_000)
    return () => globalThis.clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount-only — getSession resolves quickly on good connections

  const openAuthModal = useCallback(
    (
      next?: string,
      message?: string | null,
      _initialMode?: 'signin' | 'signup',
      initialStep?: 'form' | 'forgot',
    ) => {
      void _initialMode // legacy arg kept for call-site compatibility; morph form is email-first.
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        setPendingNext(next)
      }
      setAuthModalMessage(message ?? null)
      setAuthModalInitialStep(initialStep ?? 'form')
      setAuthModalOpen(true)
    },
    [],
  )

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false)
    setAuthModalMessage(null)
  }, [])

  const t = useT()
  const wasAuthedRef = useRef(false)
  /** Set by `signOut()` just before telling Supabase to end the session.
   *  The SIGNED_OUT handler consumes it to tell "user clicked sign out"
   *  apart from "session expired server-side" — we only want to pop the
   *  auth modal with an expiry message in the latter case. */
  const userInitiatedSignOutRef = useRef(false)

  useEffect(() => {
    if (!configured) {
      const id = globalThis.setTimeout(() => setLoading(false), 0)
      return () => globalThis.clearTimeout(id)
    }

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      const incomingUser = nextSession?.user ?? null
      if (_event === 'PASSWORD_RECOVERY') {
        // The user must still choose a new password — do NOT close the modal or
        // mark them as authenticated yet. Two sub-cases:
        //   • In-modal OTP flow (modal is open): the verifyOtp callback will
        //     transition the modal to the reset-new-password step. Return early
        //     so setUser/setAuthModalOpen(false) don't interfere.
        //   • Magic-link from email (modal closed, not already on reset page):
        //     navigate to the dedicated reset page which handles its own session.
        if (!authModalOpenRef.current && !window.location.pathname.startsWith('/reset-password')) {
          window.location.replace('/reset-password/confirm')
        }
        return
      }
      if (_event === 'SIGNED_OUT') {
        // Stop the finance sync BEFORE wiping the store, otherwise the
        // reset-to-defaults fires the subscribe listener and overwrites
        // the user's server-side settings/profile with defaults.
        try {
          suspendFinanceSync()
        } catch {
          /* no-op */
        }
        try {
          clearBudgetData()
        } catch (e) {
          console.error('[auth] clearBudgetData on SIGNED_OUT failed', e)
        }
        const intentional = userInitiatedSignOutRef.current
        userInitiatedSignOutRef.current = false
        // Only flag "session expired" when we were authed AND this wasn't
        // the user clicking Sign Out themselves. Deliberate sign-outs drop
        // to the clean landing gate.
        if (
          !intentional &&
          wasAuthedRef.current &&
          !pathnameRef.current.startsWith('/reset-password')
        ) {
          wasAuthedRef.current = false
          setAuthModalMessage(t.auth.sessionExpired)
          setAuthModalOpen(true)
        } else {
          wasAuthedRef.current = false
        }
        // Re-arm the one-shot splash so the next sign-in gets a fresh gate.
        setSplashDoneFor(null)
        setMinElapsedFor(null)
        setDataPullTimedOut(false)
      } else if (_event === 'SIGNED_IN' && incomingUser) {
        wasAuthedRef.current = true
      }
      setSession(nextSession)
      setUser(incomingUser)
      if (incomingUser) setAuthModalOpen(false)
    })

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const s = data.session
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        setAuthModalOpen(false)
        wasAuthedRef.current = true
      }
      setLoading(false)
    })

    // Native WebViews pause the auto-refresh timer while backgrounded, so the
    // access token goes stale and API calls 401. Drive startAutoRefresh on
    // foreground (which refreshes immediately if needed) and stopAutoRefresh on
    // background. On web the SDK's own timer suffices, so this is native-only.
    let onVisibility: (() => void) | undefined
    if (isNative()) {
      onVisibility = () => {
        if (document.visibilityState === 'visible') {
          // startAutoRefresh alone — it already refreshes immediately if the
          // token is stale. A manual getSession() here races the SDK's refresh
          // (single-use refresh tokens) and churns auth events on every
          // foreground, e.g. right after the Android permission dialog.
          void supabase.auth.startAutoRefresh()
        } else {
          void supabase.auth.stopAutoRefresh()
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      if (document.visibilityState === 'visible') void supabase.auth.startAutoRefresh()
    }

    return () => {
      subscription.unsubscribe()
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [configured, t.auth.sessionExpired])

  const signOut = useCallback(async () => {
    if (!configured) return
    // Mark as user-initiated so the SIGNED_OUT handler skips the "session expired" modal.
    userInitiatedSignOutRef.current = true
    // Suspend the subscribe listener synchronously so the upcoming store reset
    // doesn't trigger a flush that would overwrite server data with defaults.
    try { suspendFinanceSync() } catch { /* no-op */ }

    // Capture the token BEFORE clearing — the background push-unregister needs it.
    const accessToken = session?.access_token ?? null

    // On native: users who opted into biometric login keep their saved token
    // across an intentional sign-out — that's the whole point of the quick
    // biometric sign-in button. Everyone else gets the token wiped BEFORE
    // setUser(null) (BiometricSessionPersist unmounts with the user, so it
    // never sees session=null and can't do it).
    if (isNative()) {
      try {
        const { clearSession: clearBiometricSession, isEnabled: biometricEnabled } =
          await import('@/lib/native/biometricAuth')
        if (!(await biometricEnabled())) await clearBiometricSession()
      } catch { /* noop */ }
    }

    // Immediately clear UI — landing gate appears now, no spinner. Callers must
    // NOT call clearBudgetData() before this: doing so flips dataReady=false
    // while mode is still 'authenticated', dropping every page to skeletons.
    setUser(null)
    setSession(null)
    // Re-arm the one-shot splash for the next sign-in.
    setSplashDoneFor(null)
    setMinElapsedFor(null)
    setDataPullTimedOut(false)
    // NOTE: do NOT call router.refresh() here. On native, it triggers the
    // visibilitychange handler which calls getSession() before
    // supabase.auth.signOut() has cleared the localStorage session — the SDK
    // finds the still-valid token and fires SIGNED_IN, restoring the user.
    // The LandingGate renders automatically from setUser(null) above.

    const supabase = createClient()
    // SECURITY: clear the session token FIRST, awaited, before the slower
    // SMS/push cleanup. If the user force-quits the app mid-teardown, the token
    // must already be gone from storage — otherwise the next launch's
    // getSession() restores it and the "signed-out" user is logged back in.
    // Flush pending writes first (token still valid). Local scope clears storage
    // with NO network round-trip, so it can't hang on a slow link.
    try { await flushFinanceNow() } catch (e) { console.error('[auth] flush before signOut failed', e) }
    try { await supabase.auth.signOut({ scope: 'local' }) } catch (e) { console.error('[auth] signOut failed', e) }
    // Wipe localStorage + reset Zustand stores (also strips any sb-* auth keys).
    try { clearBudgetData() } catch (e) { console.error('[auth] clearBudgetData failed', e) }

    // Remaining best-effort cleanup — non-blocking, session is already gone.
    void (async () => {
      // Wipe per-device SMS bridge state so the next user starts with tracking OFF.
      try { const { clearSmsNative } = await import('@/lib/native/smsTracker'); await clearSmsNative() } catch (e) { console.error('[auth] clearSmsNative failed', e) }
      if (accessToken) {
        try { await unregisterPushToken(accessToken) } catch (e) { console.error('[auth] push unregister failed', e) }
      }
    })()
  }, [configured, session])

  const noopSignOut = useCallback(async () => {}, [])

  const mode: AuthMode = !configured
    ? 'landing'
    : loading
      ? 'loading'
      : user
        ? 'authenticated'
        : 'landing'

  const value = useMemo<AuthContextValue>(
    () =>
      configured
        ? {
            user,
            session,
            loading,
            signOut,
            pendingNext,
            setPendingNext,
            authModalMessage,
            authModalInitialStep,
            openAuthModal,
            closeAuthModal,
            mode,
          }
        : {
            user: null,
            session: null,
            loading: false,
            signOut: noopSignOut,
            pendingNext: '/',
            setPendingNext,
            authModalMessage: null,
            authModalInitialStep: 'form' as const,
            openAuthModal,
            closeAuthModal,
            mode: 'landing',
          },
    [
      configured,
      user,
      session,
      loading,
      signOut,
      noopSignOut,
      pendingNext,
      authModalMessage,
      authModalInitialStep,
      openAuthModal,
      closeAuthModal,
      mode,
    ],
  )

  // Reset-password + auth-callback routes must be reachable for unauthenticated
  // users — they're part of the inbound auth flow. The gate bypasses them and
  // renders children directly.
  const isBypassRoute =
    pathname.startsWith('/reset-password') || pathname.startsWith('/auth/callback')

  const skipAuthModal = pathname.startsWith('/reset-password')
  const showAuthModal = configured && !loading && authModalOpen && !user && !skipAuthModal

  // For users who signed in without ticking "Remember me": sign them out on
  // tab close so they hit the landing gate again next session.
  useEphemeralSessionGuard(mode === 'authenticated')

  const showLandingGate = mode === 'landing' && !isBypassRoute
  const showLoadingSplash = mode === 'loading' && !isBypassRoute

  // One-shot splash latch: the welcome splash shows exactly ONCE per sign-in.
  // It holds until the initial server pull lands (dataReady) AND a 1.5 s
  // minimum has elapsed, then latches off for this user. Gating on dataReady
  // alone was level-triggered: any later dataReady=false blip (token-refresh
  // churn after the Android permission dialog, background re-pull, store
  // reset) yanked the app back to the splash after the homepage had rendered.
  // Post-latch dataReady=false periods render the per-page SkeletonLists.
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Safety valve: if the initial server pull never completes (slow/failed native
  // API call), release the splash after a hard ceiling so the user is never
  // trapped on an eternal dark screen. The pull continues in the background.
  // First pull only — reset alongside the latch on sign-out.
  const dataPullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const gateUserId = user?.id ?? null
  const splashDone = gateUserId != null && splashDoneFor === gateUserId
  // True from the very first authenticated frame until the latch flips — the
  // homepage can never paint mid-splash (the latch only flips in a timeout).
  const showWelcomeScreen = mode === 'authenticated' && !isBypassRoute && !splashDone

  // Minimum 1.5 s display so the welcome screen doesn't flash on fast connections.
  // setState lives inside the timeout callback (react-compiler rule).
  useEffect(() => {
    if (!showWelcomeScreen || gateUserId == null) return
    if (minTimerRef.current) clearTimeout(minTimerRef.current)
    minTimerRef.current = setTimeout(() => {
      minTimerRef.current = null
      setMinElapsedFor(gateUserId)
    }, 1500)
    return () => {
      if (minTimerRef.current) { clearTimeout(minTimerRef.current); minTimerRef.current = null }
    }
  }, [showWelcomeScreen, gateUserId])

  // Latch once the initial pull landed (or hit the 8 s ceiling) and the minimum
  // display elapsed. Deferred a tick so the splash frame is never skipped.
  useEffect(() => {
    if (!showWelcomeScreen || gateUserId == null) return
    if (!(dataReady || dataPullTimedOut)) return
    if (minElapsedFor !== gateUserId) return
    const id = setTimeout(() => setSplashDoneFor(gateUserId), 0)
    return () => clearTimeout(id)
  }, [showWelcomeScreen, gateUserId, dataReady, dataPullTimedOut, minElapsedFor])

  // 8 s hard ceiling — arms only while the pre-latch splash is waiting on data,
  // so it can never fire (or re-splash) after the latch is set.
  useEffect(() => {
    if (!showWelcomeScreen || dataReady) {
      if (dataPullTimerRef.current) { clearTimeout(dataPullTimerRef.current); dataPullTimerRef.current = null }
      return
    }
    if (dataPullTimerRef.current) return
    dataPullTimerRef.current = setTimeout(() => {
      dataPullTimerRef.current = null
      setDataPullTimedOut(true)
    }, 8000)
  }, [showWelcomeScreen, dataReady])
  useEffect(() => () => {
    if (dataPullTimerRef.current) clearTimeout(dataPullTimerRef.current)
  }, [])

  return (
    <AuthContext.Provider value={value}>
      <DialogProvider>
        <Suspense fallback={null}>
          <AuthNextQuerySync configured={configured} />
        </Suspense>
        <PasswordUpdatedCookieSync />
        <Suspense fallback={null}>
          <RequestResetQuerySync />
        </Suspense>
        <Suspense fallback={null}>
          <AuthErrorQuerySync />
        </Suspense>
        {showLoadingSplash ? (
          <AuthLoadingSplash />
        ) : showWelcomeScreen ? (
          <Suspense fallback={<AuthLoadingSplash />}>
            <WelcomeScreen />
          </Suspense>
        ) : showLandingGate ? (
          <Suspense fallback={null}>
            <LandingGate />
          </Suspense>
        ) : (
          children
        )}
        {configured && !loading && user ? (
          <>
            <SupabaseFinanceSync userId={user.id} />
            <AnalyticsHeartbeat userId={user.id} />
            <NativeBootstrap session={session} />
            <BiometricSessionPersist session={session} />
          </>
        ) : null}
        {showAuthModal ? (
          <Suspense fallback={null}>
            <AuthModal />
          </Suspense>
        ) : null}
      </DialogProvider>
    </AuthContext.Provider>
  )
}

export { useAuth, useOptionalAuth } from '@/components/auth/auth-context'
