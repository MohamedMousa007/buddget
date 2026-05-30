'use client'

import { useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-context'
import { isSupabaseConfigured } from '@/lib/supabase/env'

/**
 * When Supabase is configured, mutating actions require a signed-in user.
 * If the session has lapsed, the auth modal opens with `message` instead
 * of running `action`.
 */
export function useRequireAuthAction() {
  const pathname = usePathname()
  const { user, loading, openAuthModal } = useAuth()

  const configured = useMemo(() => isSupabaseConfigured(), [])

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
