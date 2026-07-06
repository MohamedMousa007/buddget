'use client'

import { useEffect, useRef } from 'react'
import { Fingerprint, Loader2, ScanFace } from 'lucide-react'
import { useBiometricLogin } from '@/hooks/useBiometricLogin'
import { setPendingEnable } from '@/lib/native/biometricAuth'
import { isNative } from '@/lib/native/isNative'
import { useT } from '@/lib/i18n'

export interface BiometricMessage {
  text: string
  tone: 'muted' | 'error'
}

interface BiometricLoginButtonProps {
  /** Auto-prompt the OS biometric sheet on mount when biometric login is enabled. */
  autoPrompt?: boolean
  /** Called once Supabase reports a refreshed session. */
  onSuccess?: () => void
  /** Receives hint/error copy — rendered by the parent where there's width for it. */
  onMessage?: (msg: BiometricMessage | null) => void
}

/**
 * Compact biometric icon button for the auth screen (Face ID on iOS,
 * Fingerprint on Android). Enabled + saved session → one-tap sign-in.
 * Not enabled yet → sets the one-shot "enable after next sign-in" marker and
 * tells the user biometric will be on next time.
 */
export function BiometricLoginButton({ autoPrompt = false, onSuccess, onMessage }: BiometricLoginButtonProps) {
  const t = useT()
  const { available, type, enabled, hasSession, busy, error, trigger } = useBiometricLogin(onSuccess)
  const autoPromptedRef = useRef(false)

  const ready = enabled && hasSession

  useEffect(() => {
    onMessage?.(error ? { text: error, tone: 'error' } : null)
  }, [error, onMessage])

  useEffect(() => {
    if (!autoPrompt || autoPromptedRef.current) return
    if (!available || !ready) return
    autoPromptedRef.current = true
    void trigger()
  }, [autoPrompt, available, ready, trigger])

  if (!isNative() || !available) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? t.auth.biometricSignInFace : t.auth.biometricSignInFingerprint

  const onTap = async () => {
    if (ready) {
      void trigger()
      return
    }
    await setPendingEnable()
    onMessage?.({ text: t.auth.biometricEnableHint, tone: 'muted' })
  }

  return (
    <button
      type="button"
      onClick={() => void onTap()}
      disabled={busy}
      aria-label={label}
      title={label}
      className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] transition-colors hover:bg-[var(--color-brand-elevated)] disabled:opacity-60 sm:h-11"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
    </button>
  )
}
