'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { checkSmsPermission } from '@/lib/native/smsTracker'

/**
 * Shown inside SettingsSmsTrackingSection when isEnabled && isAndroid().
 * Permission was already requested by the toggle; this card checks current
 * grant state in case the user revoked access from system settings.
 */
export function SmsAndroidSetupCard() {
  const onNative = isNative() && isAndroid()
  const [permState, setPermState] = useState<boolean | null>(null)

  useEffect(() => {
    if (!onNative) return
    checkSmsPermission().then(setPermState)
  }, [onNative])

  if (!onNative) return null

  if (permState === null) {
    return <p className="text-xs text-[var(--color-brand-text-muted)]">Checking permission…</p>
  }

  if (permState === false) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-amber)]/40 bg-[var(--color-brand-amber)]/10 px-3 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-brand-amber)]" />
        <p className="text-xs text-[var(--color-brand-text-secondary)]">
          SMS permission was revoked. Go to{' '}
          <strong>Settings → Apps → Buddget → Permissions</strong> to restore access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Active badge */}
      <div className="flex items-center gap-2 pb-1">
        <ShieldCheck className="h-4 w-4 text-[var(--color-brand-green)]" />
        <span className="text-xs font-medium text-[var(--color-brand-green)]">
          Active — listening for bank SMS
        </span>
      </div>

    </div>
  )
}
