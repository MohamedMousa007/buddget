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
      if (!enabled || !session?.refresh_token) {
        // Not opted in (or signed out): make sure no token lingers.
        await clearSession()
        return
      }
      await saveSession(session.refresh_token)
    })()

    return () => {
      cancelled = true
    }
  }, [session?.refresh_token])

  return null
}
