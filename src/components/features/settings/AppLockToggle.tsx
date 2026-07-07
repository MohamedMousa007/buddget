'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { getLinkedAccount, isAppLockEnabled, isEnabled, setAppLockEnabled } from '@/lib/native/biometricAuth'

interface AppLockToggleProps {
  userEmail?: string
}

/**
 * Opt-in "require biometric on every launch". Only shown once biometric sign-in
 * is enabled for this account — it just requires the unlock prompt on cold launch
 * in addition to the signed-out re-login flow.
 */
export function AppLockToggle({ userEmail }: AppLockToggleProps) {
  const t = useT()
  const [show, setShow] = useState(false)
  const [enabled, setEnabledState] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const account = await getLinkedAccount()
      const on = (await isEnabled()) && account === userEmail
      const lock = on && (await isAppLockEnabled())
      if (cancelled) return
      setShow(on)
      setEnabledState(lock)
    })()
    return () => {
      cancelled = true
    }
  }, [userEmail])

  if (!show) return null

  const toggle = async () => {
    setBusy(true)
    try {
      const next = !enabled
      await setAppLockEnabled(next)
      setEnabledState(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-[var(--color-brand-red)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.settings.appLockTitle}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">{t.settings.appLockHint}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
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
    </div>
  )
}
