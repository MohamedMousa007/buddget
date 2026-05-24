'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import {
  isAvailable,
  isEnabled,
  setEnabled,
  type BiometryType,
} from '@/lib/native/biometricAuth'

/**
 * Settings row that toggles biometric sign-in on the current device. The
 * preference is stored locally (Capacitor Preferences → Keychain on iOS,
 * EncryptedSharedPreferences on Android), not in the synced AppSettings
 * payload, because the underlying refresh token is also device-scoped.
 *
 * Renders nothing on devices without biometric hardware.
 */
export function BiometricLoginToggle() {
  const [available, setAvailable] = useState(false)
  const [type, setType] = useState<BiometryType>(null)
  const [enabled, setEnabledState] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const info = await isAvailable()
      const on = await isEnabled()
      if (cancelled) return
      setAvailable(info.available)
      setType(info.type)
      setEnabledState(on)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!available) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? 'Use Face ID to sign in' : 'Use Fingerprint to sign in'

  const toggle = async () => {
    setBusy(true)
    try {
      const next = !enabled
      await setEnabled(next)
      setEnabledState(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-[var(--color-brand-red)]" />
        <div>
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{label}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Skip the password on this device after one email sign-in.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        role="switch"
        aria-checked={enabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'
        } disabled:opacity-60`}
      >
        <span
          className={`absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
