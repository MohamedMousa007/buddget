'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'
import {
  authenticate,
  getLinkedAccount,
  isAvailable,
  isEnabled,
  saveSession,
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
  const t = useT()
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
  const label = type === 'face' ? t.settings.biometricUseFace : t.settings.biometricUseFingerprint

  // Another account has biometric locked to this device
  const conflict = linkedAccount && userEmail && linkedAccount !== userEmail

  const toggle = async () => {
    if (conflict) return
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
        await setEnabled(true, userEmail)
        // Save the current refresh token now so the auth-screen biometric
        // button works immediately, not only after the next token rotation.
        const { data: { session } } = await createClient().auth.getSession()
        if (session?.refresh_token) await saveSession(session.refresh_token)
        setEnabledState(true)
        if (userEmail) setLinkedAccount(userEmail)
      } else {
        await setEnabled(false, userEmail)
        setEnabledState(false)
        setLinkedAccount(null)
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
              {conflict
                ? t.settings.biometricEnabledFor(maskEmail(linkedAccount))
                : t.settings.biometricHint}
            </p>
          </div>
        </div>
        {/* p-2.5/-m-2.5 grows the hit area to 44px without moving the layout.
            Flex-centered thumb (no absolute positioning) → robust on iOS WKWebView. */}
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy || Boolean(conflict)}
          role="switch"
          aria-checked={enabled}
          className="shrink-0 rounded-full p-2.5 -m-2.5 disabled:opacity-60"
        >
          <span
            className={`flex h-6 w-11 items-center rounded-full px-[3px] transition-colors ${
              enabled ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'
            }`}
          >
            <span
              className={`block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
                enabled ? 'translate-x-5 rtl:-translate-x-5' : ''
              }`}
            />
          </span>
        </button>
      </div>
      {conflict ? (
        <p className="text-xs text-[var(--color-brand-red)]">{t.settings.biometricConflict}</p>
      ) : null}
    </div>
  )
}
