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
  saveSession,
  type BiometryType,
} from '@/lib/native/biometricAuth'

/** Only these mean the saved refresh token itself is dead — clear it. A bare
 *  "session" match or a network/offline failure must NOT wipe the token. */
function isDeadRefreshToken(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('invalid') ||
    m.includes('expired') ||
    m.includes('revoked') ||
    m.includes('refresh token')
  )
}

/**
 * State + trigger for biometric sign-in. Restores the Supabase session from the
 * saved refresh token via `refreshSession({ refresh_token })` — the documented
 * cold-restore path (there is no active session here, so it does not race the
 * SDK auto-refresh). The token sits in encrypted Capacitor Preferences (Keychain
 * on iOS, EncryptedSharedPreferences on Android).
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
      const refreshToken = await getSavedSession()
      if (!refreshToken) throw new Error('No saved session — sign in with email once.')
      const supabase = createClient()
      const { data, error: refreshErr } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      })
      if (refreshErr) throw refreshErr
      // refreshSession rotates the single-use token — persist the new one now so
      // a kill right after restore doesn't leave a spent token behind.
      if (data.session?.refresh_token) await saveSession(data.session.refresh_token)
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Biometric sign-in failed'
      // Dismissing the OS prompt is not an error — reset silently.
      if (msg.toLowerCase().includes('cancel')) return
      setError(msg)
      // Only wipe the saved token when it's genuinely dead — never on a network
      // error (offline retry) or a generic "session missing" string.
      if (isDeadRefreshToken(msg)) {
        await clearSession()
        setHasSession(false)
      }
    } finally {
      setBusy(false)
    }
  }, [onSuccess])

  return { available, type, enabled, hasSession, linkedAccount, busy, error, trigger }
}
