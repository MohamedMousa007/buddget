'use client'

import { Fingerprint, Loader2, ScanFace } from 'lucide-react'
import { useBiometricLogin } from '@/hooks/useBiometricLogin'
import { isNative } from '@/lib/native/isNative'
import { useT } from '@/lib/i18n'

interface BiometricLoginButtonProps {
  /** Called once Supabase reports a refreshed session. */
  onSuccess?: () => void
}

/**
 * Full-width biometric sign-in button for the auth screen — appears ONLY after
 * the user has enabled biometric login in Settings and a session is saved on
 * this device (Face ID on iOS, Fingerprint on Android). Tap restores the
 * session from the encrypted refresh token.
 */
export function BiometricLoginButton({ onSuccess }: BiometricLoginButtonProps) {
  const t = useT()
  const { available, type, enabled, hasSession, busy, error, trigger } = useBiometricLogin(onSuccess)

  if (!isNative() || !available || !enabled || !hasSession) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? t.auth.biometricSignInFace : t.auth.biometricSignInFingerprint

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void trigger()}
        disabled={busy}
        className="flex h-10 sm:h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-sm font-medium text-[var(--color-brand-text-primary)] transition-colors hover:bg-[var(--color-brand-elevated)] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        <span>{label}</span>
      </button>
      {error ? (
        <p className="text-xs text-[var(--color-brand-red)] text-center" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
