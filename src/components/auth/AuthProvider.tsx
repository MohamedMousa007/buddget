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
  setStorageMode,
} from '@/lib/guest/guestSession'

/**
 * After a successful password reset, `/reset-password/confirm` signs the user out
 * and redirects to `/?passwordUpdated=1`. We watch for that flag here (rather than
 * inside AppShell, which won't mount for unauthenticated users) and open the
 * sign-in modal with a success message so the user can log in with their new
 * password. Strips the query param so a refresh doesn't re-trigger.
 */
function PasswordUpdatedQuerySync() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { openAuthModal } = useAuth()
  const t = useT()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    if (searchParams.get('passwordUpdated') !== '1') return
    handled.current = true
    openAuthModal('/', t.resetPassword.successSignInPrompt, 'signin')
    const qs = new URLSearchParams(searchParams.toString())
    qs.delete('passwordUpdated')
    const q = qs.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
  }, [searchParams, pathname, router, openAuthModal, t.resetPassword.successSignInPrompt])

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

  const startGuest = useCallback(() => {
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
    setIsGuest(true)
  }, [])

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
    router.replace('/')
  }, [router])

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
      } else if (_event === 'SIGNED_IN' && nextSession?.user) {
        // A signed-in user supersedes any guest session — flip the storage mode
        // to localStorage and drop the session-storage markers. SupabaseFinanceSync
        // handles merging guest data that's still in Zustand memory.
        setStorageMode('auth')
        setGuestFlag(false)
        setGuestNickname(null)
        setIsGuest(false)
        setGuestNicknameState(null)
      }
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) setAuthModalOpen(false)
    })

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const s = data.session
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) setAuthModalOpen(false)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [configured])

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

  const skipAuthModal = pathname.startsWith('/reset-password')
  const showAuthModal = configured && !loading && authModalOpen && !user && !skipAuthModal

  return (
    <AuthContext.Provider value={value}>
      <Suspense fallback={null}>
        <AuthNextQuerySync configured={configured} />
      </Suspense>
      <Suspense fallback={null}>
        <PasswordUpdatedQuerySync />
      </Suspense>
      {children}
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
