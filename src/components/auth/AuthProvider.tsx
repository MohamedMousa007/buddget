'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session, User } from '@supabase/supabase-js'
import { SupabaseFinanceSync } from '@/components/auth/SupabaseFinanceSync'
import { AnalyticsHeartbeat } from '@/components/auth/AnalyticsHeartbeat'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
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
        ? { user, session, loading, signOut }
        : { user: null, session: null, loading: false, signOut: noopSignOut },
    [configured, user, session, loading, signOut, noopSignOut]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {configured && !loading && user ? (
        <>
          <SupabaseFinanceSync userId={user.id} />
          <AnalyticsHeartbeat userId={user.id} />
        </>
      ) : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext) ?? null
}
