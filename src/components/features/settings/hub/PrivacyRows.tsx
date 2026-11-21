'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The hub's Privacy & data group: Sign-in & security and Privacy & lock for a signed-in user, Data & backup for everyone. */
export function PrivacyRows() {
  const copy = useSettingsHubCopy()
  const p = copy.page
  const { user } = useAuth()
  const twoFactor = useFinanceStore((s) => s.settings.twoFactorEmailEnabled)

  return (
    <SettingsSection title={p.privacy}>
      {user ? (
        <>
          <SettingsRow icon={SETTING_ICONS.shield} tone={4} solid title={copy.security.title} subtitle={copy.security.subtitle} value={twoFactor ? p.twoFactorOn : undefined} href="/settings/security" settingId="security" />
          <SettingsRow icon={SETTING_ICONS.lock} tone={1} solid title={copy.privacyLock.title} subtitle={copy.privacyLock.subtitle} href="/settings/privacy" settingId="privacyLock" />
        </>
      ) : null}
      <SettingsRow icon={SETTING_ICONS.download} tone={5} solid title={p.dataBackup} subtitle={p.dataBackupHint} href="/settings/data" />
    </SettingsSection>
  )
}
