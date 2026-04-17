'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const EPHEMERAL_KEY = 'buddget_ephemeral_session'

export function markSessionEphemeral(ephemeral: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (ephemeral) window.sessionStorage.setItem(EPHEMERAL_KEY, '1')
    else window.sessionStorage.removeItem(EPHEMERAL_KEY)
  } catch {
    /* restricted storage */
  }
}

function readEphemeral(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(EPHEMERAL_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * When the user signs in WITHOUT ticking "Remember me", we write the
 * `buddget_ephemeral_session` flag into sessionStorage. This hook watches for
 * the tab closing (`pagehide`) and calls `signOut({ scope: 'local' })` so the
 * Supabase refresh token is revoked on this device — next time they open the
 * app they'll see the landing gate again.
 *
 * Why pagehide + not beforeunload? `pagehide` is the more reliable
 * tab-close signal across mobile browsers (iOS Safari in particular) and
 * fires on background discard too. `beforeunload` is aggressive and some
 * mobile browsers don't fire it consistently.
 *
 * No-op when ephemeral flag is absent — regular sessions persist normally.
 */
export function useEphemeralSessionGuard(userSignedIn: boolean): void {
  useEffect(() => {
    if (!userSignedIn) return
    const handler = () => {
      if (!readEphemeral()) return
      try {
        const supabase = createClient()
        // Best-effort; browser may kill the JS before the network request
        // completes. For anything stronger we'd need a service-worker sync.
        void supabase.auth.signOut({ scope: 'local' })
      } catch {
        /* supabase unconfigured */
      }
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [userSignedIn])
}
