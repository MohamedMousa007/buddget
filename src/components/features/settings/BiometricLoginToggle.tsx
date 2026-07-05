'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import {
  getLinkedAccount,
  isAvailable,
  isEnabled,
  setEnabled,
  type BiometryType,
} from '@/lib/native/biometricAuth'

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}

interface BiometricLoginToggleProps {
  userEmail?: string
}

export function BiometricLoginToggle({ userEmail }: BiometricLoginToggleProps) {
  const [available, setAvailable] = useState(false)
  const [type, setType] = useState<BiometryType>(null)
  const [enabled, setEnabledState] = useState(false)
  const [linkedAccount, setLinkedAccount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const info = await isAvailable()
      const on = await isEnabled()
      const account = await getLinkedAccount()
      if (cancelled) return
      setAvailable(info.available)
      setType(info.type)
      setEnabledState(on)
      setLinkedAccount(account)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!available) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? 'Use Face ID to sign in' : 'Use Fingerprint to sign in'

  // Another account has biometric locked to this device
  const conflict = linkedAccount && userEmail && linkedAccount !== userEmail

  const toggle = async () => {
    if (conflict) return
    setBusy(true)
    try {
      const next = !enabled
      await setEnabled(next, userEmail)
      setEnabledState(next)
      if (next && userEmail) setLinkedAccount(userEmail)
      if (!next) setLinkedAccount(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-[var(--color-brand-red)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{label}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {conflict
                ? `Enabled for ${maskEmail(linkedAccount)}`
                : 'Skip the password on this device after one email sign-in.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy || Boolean(conflict)}
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
      {conflict ? (
        <p className="text-xs text-[var(--color-brand-red)]">
          Biometric is enabled for another account on this device.
        </p>
      ) : null}
    </div>
  )
}
