'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  authenticate,
  getLinkedAccount,
  getSavedSession,
  isAvailable,
  isEnabled,
  saveSession,
  type BiometryType,
} from '@/lib/native/biometricAuth'

/**
 * State + trigger for biometric sign-in. Restores the Supabase session from the
 * saved token pair via `setSession({ access_token, refresh_token })` — when the
 * access token is still valid this hydrates with no refresh-endpoint hit, so it
 * can't trip the single-use refresh-token rotation. A failure is never
 * destructive: the button and saved token stay put so the user can retry or fall
 * back to email. The pair sits in encrypted Capacitor Preferences (Keychain on
 * iOS, EncryptedSharedPreferences on Android).
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
      await authenticate()
      const saved = await getSavedSession()
      if (!saved) throw new Error('No saved session — sign in with email once.')
      const supabase = createClient()
      // setSession uses the access token when still valid (no refresh-endpoint
      // hit → no token-rotation race); only refreshes when it has expired.
      const { data, error: setErr } = saved.access_token
        ? await supabase.auth.setSession({
            access_token: saved.access_token,
            refresh_token: saved.refresh_token,
          })
        : await supabase.auth.refreshSession({ refresh_token: saved.refresh_token })
      if (setErr) throw setErr
      // Persist the (possibly rotated) tokens so a later restore stays fresh.
      if (data.session) {
        await saveSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Biometric sign-in failed'
      // Dismissing the OS prompt is not an error — reset silently.
      if (msg.toLowerCase().includes('cancel')) return
      // Non-destructive: keep the button and saved token so the user can retry
      // or fall back to email. Log the raw error for on-device diagnosis.
      console.warn('[biometric] restore failed', msg)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }, [onSuccess])

  return { available, type, enabled, hasSession, linkedAccount, busy, error, trigger }
}
