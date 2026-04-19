'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  SupabaseFinanceSync,
  flushFinanceNow,
} from '@/components/sync/SupabaseFinanceSync'
import { AnalyticsHeartbeat } from '@/components/sync/AnalyticsHeartbeat'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthContext, type AuthContextValue, type AuthMode, useAuth } from '@/components/auth/auth-context'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { useT } from '@/lib/i18n'
import { LandingGate } from '@/components/auth/LandingGate'
import { useEphemeralSessionGuard } from '@/hooks/useEphemeralSessionGuard'

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
        try {
          clearBudgetData()
        } catch (e) {
          console.error('[auth] clearBudgetData on SIGNED_OUT failed', e)
        }
        // If we were previously signed in AND the user is still on an in-app
        // route (not a deliberate sign-out from the profile page), assume the
        // session expired and re-open the auth modal with an explanation
        // instead of silently dropping them on the landing.
        if (wasAuthedRef.current && !pathname.startsWith('/reset-password')) {
          wasAuthedRef.current = false
          setAuthModalMessage(t.auth.sessionExpired)
          setAuthModalOpen(true)
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
    // Drain any debounced flush (expense just added, settings just toggled)
    // BEFORE we wipe localStorage, otherwise those writes die with the tab
    // session and never reach the server.
    try {
      await flushFinanceNow()
    } catch (e) {
      console.error('[auth] flushFinanceNow before signOut failed', e)
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

  const showLandingGate = mode === 'landing' && !isBypassRoute
  const showLoadingSplash = mode === 'loading' && !isBypassRoute

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
        children
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
