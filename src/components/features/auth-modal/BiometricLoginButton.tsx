'use client'

import { useEffect } from 'react'
import { Fingerprint, Loader2, ScanFace } from 'lucide-react'
import { useBiometricLogin } from '@/hooks/useBiometricLogin'
import { isNative } from '@/lib/native/isNative'
import { useT } from '@/lib/i18n'

interface BiometricLoginButtonProps {
  /** Called once Supabase reports a restored session. */
  onSuccess?: () => void
  /** Surfaces the biometric error to the parent form's error slot. */
  onError?: (msg: string) => void
}

/**
 * Compact icon-only biometric sign-in button — appears ONLY after the user has
 * enabled biometric login in Settings and a full session is saved on this device
 * (Face ID on iOS, Fingerprint on Android). Sits inline at the end of the email
 * row; tap restores the session. Errors bubble to the parent via onError so the
 * button stays a single icon and doesn't disturb the row layout.
 */
export function BiometricLoginButton({ onSuccess, onError }: BiometricLoginButtonProps) {
  const t = useT()
  const { available, type, enabled, hasSession, busy, error, trigger } = useBiometricLogin(onSuccess)

  useEffect(() => {
    if (error) onError?.(error)
  }, [error, onError])

  if (!isNative() || !available || !enabled || !hasSession) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? t.auth.biometricSignInFace : t.auth.biometricSignInFingerprint

  return (
    <button
      type="button"
      onClick={() => void trigger()}
      disabled={busy}
      aria-label={label}
      title={label}
      className="flex h-10 sm:h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] transition-colors hover:bg-[var(--color-brand-elevated)] disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
    </button>
  )
}
