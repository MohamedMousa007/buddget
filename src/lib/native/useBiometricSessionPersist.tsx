'use client'

import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative } from '@/lib/native/isNative'
import {
  authenticate,
  clearSession,
  consumePendingEnable,
  getLinkedAccount,
  isAvailable,
  isEnabled,
  saveSession,
  setEnabled,
} from '@/lib/native/biometricAuth'

interface BiometricSessionPersistProps {
  session: Session | null
}

/**
 * Keeps the encrypted biometric refresh token in sync with the opt-in state:
 * saves it only while the user has biometric login enabled (Settings toggle or
 * the auth-screen quick button), wipes it otherwise. Also consumes the one-shot
 * "enable after next sign-in" marker set by the auth-screen biometric button.
 */
export function BiometricSessionPersist({ session }: BiometricSessionPersistProps) {
  useEffect(() => {
    if (!isNative()) return
    let cancelled = false

    void (async () => {
      const info = await isAvailable()
      if (cancelled || !info.available) return

      let enabled = await isEnabled()

      // One-shot auto-enable: the user tapped the biometric button before
      // signing in. Verify identity once, then opt them in.
      if (!enabled && session?.refresh_token && (await consumePendingEnable())) {
        const linked = await getLinkedAccount()
        const email = session.user?.email
        if (!linked || (email && linked === email)) {
          try {
            await authenticate('Enable biometric sign-in')
            await setEnabled(true, email)
            enabled = true
          } catch {
            // Declined the prompt — stay disabled; the Settings toggle remains.
          }
        }
      }

      if (cancelled) return
      if (!enabled || !session?.refresh_token) {
        // Not opted in (or signed out): make sure no token lingers — including
        // tokens saved by the old always-on behaviour.
        await clearSession()
        return
      }
      await saveSession(session.refresh_token)
    })()

    return () => {
      cancelled = true
    }
  }, [session?.refresh_token, session?.user?.email])

  return null
}
