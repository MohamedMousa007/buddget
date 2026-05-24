'use client'

import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative } from '@/lib/native/isNative'
import { isEnabled, saveSession, clearSession, isAvailable } from '@/lib/native/biometricAuth'

interface BiometricSessionPersistProps {
  session: Session | null
  /** When true, signed-in users save their refresh token by default. */
  defaultEnabled?: boolean
}

/**
 * Persists the Supabase refresh token in encrypted Capacitor Preferences once
 * the user opts into biometric login (Settings toggle). The actual prompt is
 * gated by `BiometricLoginButton`, which reads the same key on next launch.
 */
export function BiometricSessionPersist({ session, defaultEnabled = true }: BiometricSessionPersistProps) {
  useEffect(() => {
    if (!isNative()) return
    let cancelled = false

    void (async () => {
      const info = await isAvailable()
      if (cancelled || !info.available) return

      const enabled = (await isEnabled()) || defaultEnabled
      if (!enabled) return

      if (!session?.refresh_token) {
        // Signed out — wipe the saved blob so the next open doesn't auto-prompt.
        await clearSession()
        return
      }
      await saveSession(session.refresh_token)
    })()

    return () => {
      cancelled = true
    }
  }, [session?.refresh_token, defaultEnabled])

  return null
}
