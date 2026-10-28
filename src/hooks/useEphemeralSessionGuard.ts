'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isNative } from '@/lib/native/isNative'

const EPHEMERAL_KEY = 'buddget_ephemeral_session'
/** While a tab is open it renews the marker this often; the marker is "stale" once nothing has renewed it for the grace period. */
const HEARTBEAT_MS = 20_000
const GRACE_MS = 2 * 60_000

/** Sign-in without "Remember me": leaves a marker that open tabs keep fresh. Any other sign-in clears it. */
export function markSessionEphemeral(ephemeral: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (ephemeral) window.localStorage.setItem(EPHEMERAL_KEY, String(Date.now()))
    else window.localStorage.removeItem(EPHEMERAL_KEY)
  } catch {
    /* restricted storage */
  }
}

/** True when a "Remember me" off marker exists and no tab has renewed it for longer than the grace period, i.e. the browser was closed. */
export function ephemeralSessionExpired(marker: string | null, now: number): boolean {
  if (!marker) return false
  const at = Number(marker)
  return !Number.isFinite(at) || now - at > GRACE_MS
}

function readMarker(): string | null {
  try {
    return window.localStorage.getItem(EPHEMERAL_KEY)
  } catch {
    return null
  }
}

/**
 * "Remember me" off: the session should end when the browser is closed, but a reload, a hard navigation or a second tab
 * must not sign the user out. Open tabs renew a marker in localStorage; on load, a marker that nothing has renewed for
 * two minutes means the browser was closed since, and only then is this device signed out (local scope).
 *
 * Native keeps its session: backgrounding the app is not closing it.
 */
export function useEphemeralSessionGuard(userSignedIn: boolean): void {
  useEffect(() => {
    if (!userSignedIn || isNative()) return
    if (ephemeralSessionExpired(readMarker(), Date.now())) {
      markSessionEphemeral(false)
      try {
        void createClient().auth.signOut({ scope: 'local' })
      } catch {
        /* supabase unconfigured */
      }
      return
    }
    const renew = () => {
      if (readMarker() !== null) markSessionEphemeral(true)
    }
    renew()
    const id = window.setInterval(renew, HEARTBEAT_MS)
    window.addEventListener('pagehide', renew)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pagehide', renew)
    }
  }, [userSignedIn])
}
