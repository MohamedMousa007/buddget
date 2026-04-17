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
import {
  getGuestFlag,
  setGuestFlag,
  getGuestNickname,
  setGuestNickname,
  setGuestNext,
  setStorageMode,
} from '@/lib/guest/guestSession'
import { postGuestMessage } from '@/lib/guest/guestBroadcast'
import { isPlanStageComplete } from '@/lib/onboarding/onboardingStages'
import { LandingGate } from '@/components/auth/LandingGate'
import { GuestSaveProgressBanner } from '@/components/auth/GuestSaveProgressBanner'
import { useGuestBeforeUnloadWarning } from '@/hooks/useGuestBeforeUnloadWarning'
import { useActionToast } from '@/components/ui/ActionToast'
import { snapshot } from '@/lib/supabase/remote/snapshot'
import { hasMeaningfulLocalState } from '@/lib/supabase/remote/merge'

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
  // Lazy init reads sessionStorage synchronously on client mount — no flash of
  // landing before a guest session is detected. SSR sees `false` which is fine:
  // gate logic treats `loading` as the first frame anyway.
  const [isGuest, setIsGuest] = useState<boolean>(() => getGuestFlag())
  const [guestNickname, setGuestNicknameState] = useState<string | null>(() =>
    getGuestNickname(),
  )
  // Read the onboarding state for gate decisions; cheap selector, updates when the
  // guest completes their flow so the gate releases them onto the real app.
  const onboardingState = useFinanceStore((s) => s.onboardingState)

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  const openAuthModal = useCallback(
    (next?: string, message?: string | null, initialMode?: 'signin' | 'signup') => {
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        setPendingNext(next)
      }
      setAuthModalMessage(message ?? null)
      setAuthModalInitialMode(initialMode ?? 'signin')
      setAuthModalOpen(true)
    },
    [],
  )

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false)
    setAuthModalMessage(null)
  }, [])

  const startGuest = useCallback(
    (nextAfterOnboarding?: string) => {
      // Order matters: reset in-memory state BEFORE flipping the storage mode so
      // any leftover localStorage data doesn't bleed into the guest session.
      try {
        useFinanceStore.getState().reset()
        useSettingsStore.getState().reset()
      } catch (e) {
        console.error('[auth] guest reset failed', e)
      }
      setStorageMode('guest')
      const nickname = generateGuestNickname()
      try {
        useFinanceStore.getState().updateProfile({ name: nickname })
      } catch (e) {
        console.error('[auth] guest updateProfile failed', e)
      }
      setGuestFlag(true)
      setGuestNickname(nickname)
      setGuestNicknameState(nickname)
      setGuestNext(nextAfterOnboarding ?? null)
      setIsGuest(true)
      postGuestMessage({
        kind: 'guest-started',
        nickname,
        next: nextAfterOnboarding ?? null,
      })
      // Navigate immediately so there's no render frame of landing → dashboard →
      // onboarding. The AuthProvider mode-derived redirect still runs as a fallback.
      router.replace('/guest-onboarding')
    },
    [router],
  )

  const endGuest = useCallback(async () => {
    // clearBudgetData is dual-storage and wipes the guest keys too.
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[auth] endGuest clearBudgetData failed', e)
    }
    setStorageMode(null)
    setIsGuest(false)
    setGuestNicknameState(null)
    postGuestMessage({ kind: 'guest-ended' })
    router.replace('/')
  }, [router])

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
      if (_event === 'SIGNED_OUT') {
        try {
          clearBudgetData()
        } catch (e) {
          console.error('[auth] clearBudgetData on SIGNED_OUT failed', e)
        }
        setStorageMode(null)
        setIsGuest(false)
        setGuestNicknameState(null)
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
      } else if (_event === 'SIGNED_IN' && nextSession?.user) {
        // A signed-in user supersedes any guest session — flip the storage mode
        // to localStorage and drop the session-storage markers. SupabaseFinanceSync
        // handles merging guest data that's still in Zustand memory.
        // NOTE: promotion of guest → skip-expert-onboarding runs in the auth
        // handlers themselves (useAuthModal) so the redirect can await it.
        const comingFromGuest = getGuestFlag()
        const hadGuestData = comingFromGuest
          ? hasMeaningfulLocalState(snapshot(useFinanceStore.getState()))
          : false
        setStorageMode('auth')
        setGuestFlag(false)
        setGuestNickname(null)
        setIsGuest(false)
        setGuestNicknameState(null)
        wasAuthedRef.current = true
        if (hadGuestData) {
          // Confirm-on-merge toast — user keeps their guest entries now that
          // they have a real account. Strictly informational; the actual merge
          // is handled by SupabaseFinanceSync (mergeSnapshots union-by-id).
          try {
            showToast(t.guest.mergedToast)
          } catch {
            /* toast provider not mounted — fine */
          }
        }
      }
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) setAuthModalOpen(false)
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
  }, [configured, pathname, showToast, t.auth.sessionExpired, t.guest.mergedToast])

  const signOut = useCallback(async () => {
    if (!configured) return
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[auth] clearBudgetData before signOut failed', e)
    }
    setStorageMode(null)
    setIsGuest(false)
    setGuestNicknameState(null)
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
        ? 'authenticated'
        : isGuest
          ? 'guest'
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

  // Warn guests before tab close / reload regardless of whether they finished
  // onboarding — losing 4 steps of typing is as painful as losing 3 expenses.
  useGuestBeforeUnloadWarning(mode === 'guest')

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
      {showLoadingSplash ? (
        <AuthLoadingSplash />
      ) : showLandingGate ? (
        <LandingGate />
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
