'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AppLockToggle } from '@/components/features/settings/AppLockToggle'
import { BiometricLoginToggle } from '@/components/features/settings/BiometricLoginToggle'
import { BalancePrivacyCard } from '@/components/features/settings/hub/BalancePrivacyCard'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { isNative } from '@/lib/native/isNative'
import { navigate } from '@/lib/navigation/navigate'

/** Privacy and lock: biometric sign-in and app lock (on the phone only), then where balances are hidden. Signed in only, like the security screen. */
export default function SettingsPrivacyPage() {
  const copy = useSettingsHubCopy()
  const { user } = useAuth()

  useEffect(() => {
    if (user === null) navigate('/settings', { replace: true })
  }, [user])

  if (!user) return null
  const hasPassword = ((user.app_metadata?.providers as string[] | undefined) ?? ['email']).includes('email')

  return (
    <SettingsSubPageShell title={copy.privacyLock.title}>
      {isNative() ? (
        <div className="space-y-1.5">
          <SettingsSection title={copy.privacyLock.lock}>
            <div data-setting-id="biometric"><BiometricLoginToggle userEmail={user.email} hasPassword={hasPassword} bare /></div>
            <div data-setting-id="appLock"><AppLockToggle userEmail={user.email} bare /></div>
          </SettingsSection>
          <p className="px-1 text-xs text-[var(--color-brand-text-muted)]">{copy.privacyLock.lockNote}</p>
        </div>
      ) : null}
      <BalancePrivacyCard />
    </SettingsSubPageShell>
  )
}
