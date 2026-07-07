'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, Loader2, ScanFace } from 'lucide-react'
import { biometricSignIn, getType, isEnabled, type BiometryType } from '@/lib/native/biometricAuth'
import { isNative } from '@/lib/native/isNative'
import { useT } from '@/lib/i18n'

interface BiometricLoginButtonProps {
  /** Surfaces the biometric error to the parent form's error slot. */
  onError?: (msg: string) => void
}

/**
 * Signed-out biometric sign-in button. Appears when this device has a remembered
 * account (biometric enabled). Tapping mints a FRESH session via the device-token
 * backend (`biometricSignIn`) — no stored Supabase token is replayed — and the
 * resulting SIGNED_IN event swaps the gate. Sits inline at the end of the email
 * row; errors bubble to the parent so the button stays a single icon.
 */
export function BiometricLoginButton({ onError }: BiometricLoginButtonProps) {
  const t = useT()
  const [type, setType] = useState<BiometryType>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const on = isNative() && (await isEnabled())
      const kind = on ? await getType() : null
      if (cancelled) return
      setReady(on)
      setType(kind)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? t.auth.biometricSignInFace : t.auth.biometricSignInFingerprint

  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      const ok = await biometricSignIn(t.settings.biometricConfirmReason)
      // Success flows through onAuthStateChange → the gate swaps to the app.
      if (!ok) onError?.(t.auth.sessionExpired)
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : ''
      // Cancel / dismiss is not an error.
      if (!msg.includes('cancel')) onError?.(t.auth.sessionExpired)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      aria-label={label}
      title={label}
      className="flex h-10 sm:h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] transition-colors hover:bg-[var(--color-brand-elevated)] disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
    </button>
  )
}
