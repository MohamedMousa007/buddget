'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { SupabaseFinanceSync } from '@/components/sync/SupabaseFinanceSync'
import { AnalyticsHeartbeat } from '@/components/sync/AnalyticsHeartbeat'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthContext, type AuthContextValue, type AuthMode, useAuth } from '@/components/auth/auth-context'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { generateGuestNickname } from '@/lib/guest/nicknameGenerator'
import { isPlanStageComplete } from '@/lib/onboarding/onboardingStages'
import { LandingGate } from '@/components/auth/LandingGate'
import { GuestSaveProgressBanner } from '@/components/auth/GuestSaveProgressBanner'
import { useEphemeralSessionGuard } from '@/hooks/useEphemeralSessionGuard'
import { useActionToast } from '@/components/ui/ActionToast'

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
 *
 * The cookie is HttpOnly and set by the server, so unlike the old
 * `?passwordUpdated=1` query param it can't be forged by a random visitor
 * typing a URL.
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
  // We don't use useAuth here because the forgot step needs to be opened
  // with a specific `step: 'forgot'` default. Easiest: set the flag via the
  // same openAuthModal API but then flip step via a follow-up. The auth
  // modal hook supports `step` via its own setStep; we simulate that by
  // using the message as the trigger for the modal.
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
  const [pendingNext, setPendingNext] = useState('/')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null)
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'signin' | 'signup'>('signin')
  const [authModalInitialStep, setAuthModalInitialStep] = useState<'form' | 'forgot'>('form')
  // Lazy init reads sessionStorage synchronously on client mount — no flash of
  // landing before a guest session is detected. SSR sees `false` which is fine:
  // `mode` is now derived from `user.is_anonymous`. We keep a local nickname
  // so the banner can greet the user without refetching profile.name.
  const [guestNickname, setGuestNicknameState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem('buddget_guest_nickname')
    } catch {
      return null
    }
  })
  // Read the onboarding state for gate decisions; cheap selector, updates when the
  // guest completes their flow so the gate releases them onto the real app.
  const onboardingState = useFinanceStore((s) => s.onboardingState)

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  const openAuthModal = useCallback(
    (
      next?: string,
      message?: string | null,
      initialMode?: 'signin' | 'signup',
      initialStep?: 'form' | 'forgot',
    ) => {
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        setPendingNext(next)
      }
      setAuthModalMessage(message ?? null)
      setAuthModalInitialMode(initialMode ?? 'signin')
      setAuthModalInitialStep(initialStep ?? 'form')
      setAuthModalOpen(true)
    },
    [],
  )

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false)
    setAuthModalMessage(null)
  }, [])

  const startGuest = useCallback(
    async (nextAfterOnboarding?: string) => {
      if (!configured) return
      // Reset in-memory state first so any leftover localStorage from a prior
      // session doesn't bleed into the new anonymous identity.
      try {
        useFinanceStore.getState().reset()
        useSettingsStore.getState().reset()
      } catch (e) {
        console.error('[auth] guest reset failed', e)
      }
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.user) {
        console.error('[auth] signInAnonymously failed', error?.message)
        return
      }
      const nickname = generateGuestNickname()
      try {
        useFinanceStore.getState().updateProfile({ name: nickname })
      } catch (e) {
        console.error('[auth] guest updateProfile failed', e)
      }
      // Persist nickname + optional deep-link target in localStorage now that
      // the session itself is owned by Supabase. Accessible across tabs.
      try {
        window.localStorage.setItem('buddget_guest_nickname', nickname)
        if (nextAfterOnboarding && nextAfterOnboarding.startsWith('/')) {
          window.localStorage.setItem('buddget_guest_next', nextAfterOnboarding)
        }
      } catch {
        /* private mode / quota */
      }
      setGuestNicknameState(nickname)
      // `onAuthStateChange SIGNED_IN` will flip the mode; we just navigate.
      router.replace('/guest-onboarding')
    },
    [configured, router],
  )

  const endGuest = useCallback(async () => {
    if (!configured) return
    const supabase = createClient()
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (e) {
      console.error('[auth] endGuest signOut failed', e)
    }
    try {
      window.localStorage.removeItem('buddget_guest_nickname')
      window.localStorage.removeItem('buddget_guest_next')
    } catch {
      /* private mode */
    }
    setGuestNicknameState(null)
    router.replace('/')
  }, [configured, router])

  const t = useT()
  const wasAuthedRef = useRef(false)
  const showToast = useActionToast()

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
      const incomingIsAnon = incomingUser?.is_anonymous === true
      if (_event === 'SIGNED_OUT') {
        try {
          clearBudgetData()
        } catch (e) {
          console.error('[auth] clearBudgetData on SIGNED_OUT failed', e)
        }
        setGuestNicknameState(null)
        try {
          window.localStorage.removeItem('buddget_guest_nickname')
          window.localStorage.removeItem('buddget_guest_next')
        } catch {
          /* private mode */
        }
        // If we were previously signed in AND the user is still on an in-app
        // route (not a deliberate sign-out from the profile page), assume the
        // session expired and re-open the auth modal with an explanation
        // instead of silently dropping them on the landing.
        if (wasAuthedRef.current && !pathname.startsWith('/reset-password')) {
          wasAuthedRef.current = false
          setAuthModalMessage(t.auth.sessionExpired)
          setAuthModalInitialMode('signin')
          setAuthModalOpen(true)
        }
      } else if (_event === 'SIGNED_IN' && incomingUser) {
        if (incomingIsAnon) {
          // Anonymous (guest) session just started. The nickname was written
          // by `startGuest`; mode derivation picks up `is_anonymous` below.
        } else {
          wasAuthedRef.current = true
        }
      } else if (_event === 'USER_UPDATED' && incomingUser && !incomingIsAnon) {
        // Anonymous → real account promotion (updateUser with email + OTP
        // verified). Show the merge-confirmation toast since the guest's data
        // just became permanent on the same user_id.
        try {
          showToast(t.guest.mergedToast)
        } catch {
          /* toast not mounted */
        }
        wasAuthedRef.current = true
      }
      setSession(nextSession)
      setUser(incomingUser)
      if (incomingUser && !incomingIsAnon) setAuthModalOpen(false)
    })

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const s = data.session
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user && !s.user.is_anonymous) {
        setAuthModalOpen(false)
        wasAuthedRef.current = true
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [configured, pathname, showToast, t.auth.sessionExpired, t.guest.mergedToast])

  const signOut = useCallback(async () => {
    if (!configured) return
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[auth] clearBudgetData before signOut failed', e)
    }
    setGuestNicknameState(null)
    try {
      window.localStorage.removeItem('buddget_guest_nickname')
      window.localStorage.removeItem('buddget_guest_next')
    } catch {
      /* private mode */
    }
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } finally {
      setUser(null)
      setSession(null)
      router.refresh()
    }
  }, [configured, router])

  const noopSignOut = useCallback(async () => {}, [])

  const mode: AuthMode = !configured
    ? 'landing'
    : loading
      ? 'loading'
      : user
        ? user.is_anonymous
          ? 'guest'
          : 'authenticated'
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
            authModalInitialMode,
            authModalInitialStep,
            openAuthModal,
            closeAuthModal,
            mode,
            guestNickname,
            startGuest,
            endGuest,
          }
        : {
            user: null,
            session: null,
            loading: false,
            signOut: noopSignOut,
            pendingNext: '/',
            setPendingNext,
            authModalMessage: null,
            authModalInitialMode: 'signin' as const,
            authModalInitialStep: 'form' as const,
            openAuthModal,
            closeAuthModal,
            mode: 'landing',
            guestNickname: null,
            startGuest,
            endGuest,
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
      authModalInitialMode,
      authModalInitialStep,
      openAuthModal,
      closeAuthModal,
      mode,
      guestNickname,
      startGuest,
      endGuest,
    ]
  )

  // Reset-password + auth-callback routes must be reachable for unauthenticated
  // users — they're part of the inbound auth flow. The gate bypasses them and
  // renders children directly.
  const isBypassRoute =
    pathname.startsWith('/reset-password') || pathname.startsWith('/auth/callback')

  const skipAuthModal = pathname.startsWith('/reset-password')
  const showAuthModal = configured && !loading && authModalOpen && !user && !skipAuthModal

  const guestOnboardingDone = isPlanStageComplete(onboardingState)
  const shouldRedirectGuestToOnboarding =
    mode === 'guest' && !guestOnboardingDone && pathname !== '/guest-onboarding' && !isBypassRoute

  useEffect(() => {
    if (shouldRedirectGuestToOnboarding) router.replace('/guest-onboarding')
  }, [shouldRedirectGuestToOnboarding, router])

  // For users who signed in without ticking "Remember me": sign them out on
  // tab close so they hit the landing gate again next session.
  useEphemeralSessionGuard(mode === 'authenticated')
  // NB: `useGuestBeforeUnloadWarning` is retired — guest sessions now persist
  // server-side via Supabase anonymous auth, so tab close doesn't lose data.

  const showLandingGate = mode === 'landing' && !isBypassRoute
  const showLoadingSplash = mode === 'loading' && !isBypassRoute
  const showGuestBanner =
    mode === 'guest' &&
    guestOnboardingDone &&
    pathname !== '/guest-onboarding' &&
    !isBypassRoute

  return (
    <AuthContext.Provider value={value}>
      <Suspense fallback={null}>
        <AuthNextQuerySync configured={configured} />
      </Suspense>
      <PasswordUpdatedCookieSync />
      <Suspense fallback={null}>
        <RequestResetQuerySync />
      </Suspense>
      {showLoadingSplash ? (
        <AuthLoadingSplash />
      ) : showLandingGate ? (
        <Suspense fallback={null}>
          <LandingGate />
        </Suspense>
      ) : (
        <>
          {showGuestBanner ? <GuestSaveProgressBanner /> : null}
          {children}
        </>
      )}
      {configured && !loading && user ? (
        <>
          <SupabaseFinanceSync userId={user.id} />
          <AnalyticsHeartbeat userId={user.id} />
        </>
      ) : null}
      {showAuthModal ? (
        <Suspense fallback={null}>
          <AuthModal />
        </Suspense>
      ) : null}
    </AuthContext.Provider>
  )
}

export { useAuth, useOptionalAuth } from '@/components/auth/auth-context'
