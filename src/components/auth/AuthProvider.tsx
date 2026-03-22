'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { SupabaseFinanceSync } from '@/components/sync/SupabaseFinanceSync'
import { AnalyticsHeartbeat } from '@/components/sync/AnalyticsHeartbeat'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthContext, type AuthContextValue } from '@/components/auth/auth-context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingNext, setPendingNext] = useState('/')

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  const openAuthModal = useCallback((next?: string) => {
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      setPendingNext(next)
    }
  }, [])

  useEffect(() => {
    if (!configured) {
      const id = globalThis.setTimeout(() => setLoading(false), 0)
      return () => globalThis.clearTimeout(id)
    }

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const s = data.session
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [configured])

  const signOut = useCallback(async () => {
    if (!configured) return
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [configured])

  const noopSignOut = useCallback(async () => {}, [])

  const value = useMemo(
    () =>
      configured
        ? {
            user,
            session,
            loading,
            signOut,
            pendingNext,
            setPendingNext,
            openAuthModal,
          }
        : {
            user: null,
            session: null,
            loading: false,
            signOut: noopSignOut,
            pendingNext: '/',
            setPendingNext,
            openAuthModal,
          },
    [configured, user, session, loading, signOut, noopSignOut, pendingNext, openAuthModal]
  )

  const skipAuthModal = pathname.startsWith('/reset-password')
  const showAuthModal = configured && !loading && !user && !skipAuthModal

  return (
    <AuthContext.Provider value={value}>
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
