'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  authenticate,
  clearSession,
  getLinkedAccount,
  getSavedSession,
  isAvailable,
  isEnabled,
  type BiometryType,
} from '@/lib/native/biometricAuth'

/**
 * State + trigger for biometric sign-in. The Supabase session is restored via
 * `setSession({ refresh_token })`; the refresh token sits in encrypted
 * Capacitor Preferences (Keychain on iOS, EncryptedSharedPreferences on
 * Android). Never calls refreshSession() — that races the SDK.
 */
export function useBiometricLogin(onSuccess?: () => void) {
  const [available, setAvailable] = useState(false)
  const [type, setType] = useState<BiometryType>(null)
  const [enabled, setEnabled] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [linkedAccount, setLinkedAccount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const info = await isAvailable()
      const on = await isEnabled()
      const saved = await getSavedSession()
      const account = await getLinkedAccount()
      if (cancelled) return
      setAvailable(info.available)
      setType(info.type)
      setEnabled(on)
      setHasSession(Boolean(saved))
      setLinkedAccount(account)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const trigger = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await authenticate('Confirm your identity')
      const refreshToken = await getSavedSession()
      if (!refreshToken) throw new Error('No saved session — sign in with email once.')
      const supabase = createClient()
      const { error: setErr } = await supabase.auth.setSession({
        access_token: '',
        refresh_token: refreshToken,
      })
      if (setErr) throw setErr
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Biometric sign-in failed'
      // Dismissing the OS prompt is not an error — reset silently.
      if (msg.toLowerCase().includes('cancel')) return
      setError(msg)
      // Clear obviously-stale session so we don't loop the user.
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('session')) {
        await clearSession()
        setHasSession(false)
      }
    } finally {
      setBusy(false)
    }
  }, [onSuccess])

  return { available, type, enabled, hasSession, linkedAccount, busy, error, trigger }
}
