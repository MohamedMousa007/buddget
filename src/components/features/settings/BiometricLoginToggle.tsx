'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Switch } from '@/components/ui/switch'
import { TwoFactorOffSheet } from '@/components/features/settings/hub/TwoFactorOffSheet'
import { useActionToast } from '@/components/ui/ActionToast'
import {
  authenticate,
  getLinkedAccount,
  isAvailable,
  isEnabled,
  registerBiometric,
  unregisterBiometric,
  type BiometryType,
} from '@/lib/native/biometricAuth'
import type { TwoFactorResult } from '@/lib/auth/twoFactor'

interface BiometricLoginToggleProps {
  userEmail?: string
  /** False for Google/Apple-only accounts: the re-auth prompt then relies on a fresh sign-in instead of a typed password. */
  hasPassword?: boolean
  /** Drop the card chrome so the toggle sits as a row inside another card. */
  bare?: boolean
}

export function BiometricLoginToggle({ userEmail, hasPassword = true, bare = false }: BiometricLoginToggleProps) {
  const t = useT()
  const toast = useActionToast()
  const [available, setAvailable] = useState(false)
  const [type, setType] = useState<BiometryType>(null)
  const [enabled, setEnabledState] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

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
      // as off here; it must be turned off on that account first.
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
        const result = await registerBiometric(userEmail)
        setEnabledState(result === 'ok')
        if (result === 'conflict') toast(t.settings.biometricOwnedByOther)
        if (result === 'reauth_required') setReauthOpen(true)
      } else {
        await unregisterBiometric()
        setEnabledState(false)
      }
    } finally {
      setBusy(false)
    }
  }

  const enrolWithPassword = async (password: string | undefined): Promise<TwoFactorResult> => {
    const result = await registerBiometric(userEmail, password)
    if (result === 'conflict') toast(t.settings.biometricOwnedByOther)
    return result === 'ok' || result === 'wrong_password' || result === 'reauth_required' || result === 'rate_limited' ? result : 'failed'
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
      <TwoFactorOffSheet
        open={reauthOpen}
        purpose="biometricEnrol"
        hasPassword={hasPassword}
        onConfirm={enrolWithPassword}
        onClose={() => setReauthOpen(false)}
        onTurnedOff={() => { setEnabledState(true); setReauthOpen(false) }}
      />
    </div>
  )
}
