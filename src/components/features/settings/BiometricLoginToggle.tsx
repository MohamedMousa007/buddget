'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import { useT } from '@/lib/i18n'
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
}

export function BiometricLoginToggle({ userEmail }: BiometricLoginToggleProps) {
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
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-[var(--color-brand-red)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{label}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {t.settings.biometricHint}
            </p>
          </div>
        </div>
        {/* p-2.5/-m-2.5 grows the hit area to 44px without moving the layout.
            Flex-centered thumb (no absolute positioning) → robust on iOS WKWebView. */}
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          role="switch"
          aria-checked={enabled}
          className="shrink-0 rounded-full p-2.5 -m-2.5 disabled:opacity-60"
        >
          <span
            className={`flex h-6 w-11 items-center rounded-full px-1 transition-colors ${
              enabled ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? 'translate-x-5 rtl:-translate-x-5' : ''
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  )
}
