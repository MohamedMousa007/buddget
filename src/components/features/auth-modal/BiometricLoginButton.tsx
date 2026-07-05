'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Fingerprint, Loader2, ScanFace } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  authenticate,
  clearSession,
  getLinkedAccount,
  getSavedSession,
  isAvailable,
  type BiometryType,
} from '@/lib/native/biometricAuth'

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}

interface BiometricLoginButtonProps {
  /** Auto-prompt the OS biometric sheet on mount when conditions are met. */
  autoPrompt?: boolean
  /** Called once Supabase reports a refreshed session. */
  onSuccess?: () => void
}

/**
 * Renders a one-tap biometric sign-in button when the device supports
 * biometrics AND a previous session was saved on this device. The actual
 * Supabase session is restored via `setSession({ refresh_token })`; the
 * refresh token itself sits in encrypted Capacitor Preferences (Keychain on
 * iOS, EncryptedSharedPreferences on Android).
 */
export function BiometricLoginButton({ autoPrompt = false, onSuccess }: BiometricLoginButtonProps) {
  const [available, setAvailable] = useState<boolean>(false)
  const [type, setType] = useState<BiometryType>(null)
  const [hasSession, setHasSession] = useState<boolean>(false)
  const [linkedAccount, setLinkedAccount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoPromptedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const info = await isAvailable()
      const saved = await getSavedSession()
      const account = await getLinkedAccount()
      if (cancelled) return
      setAvailable(info.available)
      setType(info.type)
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

  useEffect(() => {
    if (!autoPrompt || autoPromptedRef.current) return
    if (!available || !hasSession) return
    autoPromptedRef.current = true
    void trigger()
  }, [autoPrompt, available, hasSession, trigger])

  if (!available || !hasSession) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void trigger()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-card)] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        <span>{label}</span>
      </button>
      {error ? (
        <p className="text-xs text-[var(--color-brand-red)] text-center">{error}</p>
      ) : linkedAccount ? (
        <p className="text-xs text-[var(--color-brand-text-muted)] text-center">{maskEmail(linkedAccount)}</p>
      ) : null}
    </div>
  )
}
