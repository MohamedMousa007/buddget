'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { getLinkedAccount, isAppLockEnabled, isEnabled, setAppLockEnabled } from '@/lib/native/biometricAuth'
import { Switch } from '@/components/ui/switch'

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
          <Lock className="h-5 w-5 text-[var(--color-brand-primary-ink)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.settings.appLockTitle}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">{t.settings.appLockHint}</p>
          </div>
        </div>
        <Switch
          size="touch"
          aria-label={t.settings.appLockTitle}
          checked={enabled}
          disabled={busy}
          onCheckedChange={() => void toggle()}
        />
      </div>
    </div>
  )
}
