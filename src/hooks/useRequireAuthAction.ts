'use client'

import { useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-context'

/**
 * When Supabase is configured, mutating actions require a signed-in user.
 * If the session has lapsed, the auth modal opens with `message` instead
 * of running `action`.
 */
export function useRequireAuthAction() {
  const pathname = usePathname()
  const { user, loading, openAuthModal } = useAuth()

  const configured = useMemo(() => {
    return !!(
      typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim() &&
      typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
    )
  }, [])

  return useCallback(
    (action: () => void, message: string) => {
      if (!configured) {
        action()
        return
      }
      if (loading) return
      if (!user) {
        openAuthModal(pathname, message)
        return
      }
      action()
    },
    [configured, loading, user, pathname, openAuthModal]
  )
}
