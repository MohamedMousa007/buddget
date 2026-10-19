'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Switch } from '@/components/ui/switch'
import {
  authenticate,
  getLinkedAccount,
  isAvailable,
  isEnabled,
  registerBiometric,
  unregisterBiometric,
  type BiometryType,
} from '@/lib/native/biometricAuth'

interface BiometricLoginToggleProps {
  userEmail?: string
  /** Drop the card chrome so the toggle sits as a row inside another card. */
  bare?: boolean
}

export function BiometricLoginToggle({ userEmail, bare = false }: BiometricLoginToggleProps) {
  const t = useT()
  const [available, setAvailable] = useState(false)
  const [type, setType] = useState<BiometryType>(null)
  const [enabled, setEnabledState] = useState(false)
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
      // Enabled for THIS account only — a device bound to another account reads
      // as off here; toggling on takes over the binding.
      setEnabledState(on && account === userEmail)
    })()
    return () => {
      cancelled = true
    }
  }, [userEmail])

  if (!available) return null

  const Icon = type === 'face' ? ScanFace : Fingerprint
  const label = type === 'face' ? t.settings.biometricUseFace : t.settings.biometricUseFingerprint

  const toggle = async () => {
    setBusy(true)
    try {
      if (!enabled) {
        // Verify identity first — on iOS this is also what triggers the OS
        // Face ID permission prompt. Declining leaves the switch off.
        try {
          await authenticate(t.settings.biometricConfirmReason)
        } catch {
          return
        }
        // Registers a device secret with the backend, taking over any previous
        // account bound to this device.
        const ok = await registerBiometric(userEmail)
        setEnabledState(ok)
      } else {
        await unregisterBiometric()
        setEnabledState(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={bare ? 'px-4 py-3' : 'rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 space-y-1'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-[var(--color-brand-primary-ink)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{label}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {t.settings.biometricHint}
            </p>
          </div>
        </div>
        <Switch
          size="touch"
          aria-label={label}
          checked={enabled}
          disabled={busy}
          onCheckedChange={() => void toggle()}
        />
      </div>
    </div>
  )
}
