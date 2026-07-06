'use client'

import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative } from '@/lib/native/isNative'
import { clearSession, isAvailable, isEnabled, saveSession } from '@/lib/native/biometricAuth'

interface BiometricSessionPersistProps {
  session: Session | null
}

/**
 * Keeps the encrypted biometric refresh token in sync with the opt-in state:
 * saves it only while the user has biometric login enabled (Settings toggle),
 * wipes it otherwise (including stale tokens from any earlier always-on
 * behaviour). Enabling itself happens only via the Settings toggle.
 */
export function BiometricSessionPersist({ session }: BiometricSessionPersistProps) {
  useEffect(() => {
    if (!isNative()) return
    let cancelled = false

    void (async () => {
      const info = await isAvailable()
      if (cancelled || !info.available) return

      const enabled = await isEnabled()
      if (!enabled) {
        // Opted out: make sure no token lingers.
        await clearSession()
        return
      }
      // Enabled: only (re)save when we actually have a live session. A transient
      // null session (e.g. the signed-out auth screen) must NOT wipe the saved
      // pair — that would erase the biometric login the user is about to use.
      if (session?.access_token && session.refresh_token) {
        await saveSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session?.refresh_token])

  return null
}
