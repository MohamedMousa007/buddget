'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  SupabaseFinanceSync,
  flushFinanceNow,
  suspendFinanceSync,
} from '@/components/sync/SupabaseFinanceSync'
import { AnalyticsHeartbeat } from '@/components/sync/AnalyticsHeartbeat'
import { NativeBootstrap } from '@/lib/native/NativeBootstrap'
import { BiometricSessionPersist } from '@/lib/native/useBiometricSessionPersist'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthContext, type AuthContextValue, type AuthMode, useAuth } from '@/components/auth/auth-context'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { useT } from '@/lib/i18n'
import { LandingGate } from '@/components/auth/LandingGate'
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
        const res = await fetch('/api/auth/password-updated', { method: 'GET' })
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
  const router = useRouter()
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  /** Cover the sign-out transition with the splash so the dashboard doesn't
   *  visibly flash back to default theme/data while `clearBudgetData` +
   *  `supabase.auth.signOut` complete. Cleared when `user` becomes null. */
  const [signingOut, setSigningOut] = useState(false)
  const [pendingNext, setPendingNext] = useState('/')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null)
  const [authModalInitialStep, setAuthModalInitialStep] = useState<'form' | 'forgot'>('form')

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

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
          !pathname.startsWith('/reset-password')
        ) {
          wasAuthedRef.current = false
          setAuthModalMessage(t.auth.sessionExpired)
          setAuthModalOpen(true)
        } else {
          wasAuthedRef.current = false
        }
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

    return () => subscription.unsubscribe()
  }, [configured, pathname, t.auth.sessionExpired])

  const signOut = useCallback(async () => {
    if (!configured) return
    // Mark this sign-out as user-initiated so the onAuthStateChange SIGNED_OUT
    // handler skips the "session expired" modal and lands the user cleanly
    // on the landing gate.
    userInitiatedSignOutRef.current = true
    // Cover the transition with the splash so the dashboard doesn't flash
    // back to defaults while flush/clear/signOut complete.
    setSigningOut(true)
    // Drain any debounced flush (expense just added, settings just toggled)
    // BEFORE we wipe localStorage, otherwise those writes die with the tab
    // session and never reach the server.
    try {
      await flushFinanceNow()
    } catch (e) {
      console.error('[auth] flushFinanceNow before signOut failed', e)
    }
    // Now suspend the subscribe listener so the upcoming reset-to-defaults
    // doesn't trigger an instant flush that would overwrite the user's
    // theme / currency / profile on the server with defaults.
    try {
      suspendFinanceSync()
    } catch {
      /* no-op */
    }
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[auth] clearBudgetData before signOut failed', e)
    }
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } finally {
      setUser(null)
      setSession(null)
      setSigningOut(false)
      router.refresh()
    }
  }, [configured, router])

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

  const showLandingGate = mode === 'landing' && !isBypassRoute && !signingOut
  const showLoadingSplash = (mode === 'loading' || signingOut) && !isBypassRoute

  /**
   * Post-signup flash guard: a freshly signed-up user briefly renders
   * whatever route the auth modal was opened from (usually `/`) before
   * the client-side `router.replace('/onboarding')` in useAuthModal
   * completes. Middleware redirects server-side, but that's a separate
   * request — the SPA render happens first.
   *
   * Block children until one of:
   *   - the user is already on `/onboarding`
   *   - `user_metadata.onboarding_completed === true`
   *
   * Bypass routes (reset-password, auth callback) always render.
   */
  const onboardingDoneMeta = user?.user_metadata?.onboarding_completed === true
  const onOnboardingRoute = pathname.startsWith('/onboarding')
  const showOnboardingRedirectSplash =
    mode === 'authenticated' &&
    !onboardingDoneMeta &&
    !onOnboardingRoute &&
    !isBypassRoute

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
        {showLoadingSplash || showOnboardingRedirectSplash ? (
          <AuthLoadingSplash />
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
