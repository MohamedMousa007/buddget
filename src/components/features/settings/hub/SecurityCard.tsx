'use client'

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { DevicesSheet } from './DevicesSheet'
import { TwoFactorOffSheet } from './TwoFactorOffSheet'
import { AppLockToggle } from '@/components/features/settings/AppLockToggle'
import { BiometricLoginToggle } from '@/components/features/settings/BiometricLoginToggle'
import { SettingsChip, SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useProfilePage } from '@/hooks/useProfilePage'
import { setTwoFactor } from '@/lib/auth/twoFactor'
import { fetchDevices, writeCachedDevices } from '@/lib/devices/notify'
import { isNative } from '@/lib/native/isNative'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

type Profile = ReturnType<typeof useProfilePage>

/** The way into the sign-in and security screen, on the settings page. */
export function SecurityEntry() {
  const copy = useSettingsHubCopy()
  return (
    <SettingsSection title={copy.groupName.security}>
      <SettingsRow icon={SETTING_ICONS.shield} tone={GROUP_TONE.security} title={copy.security.title} subtitle={copy.security.subtitle} href="/settings/security" settingId="security" />
    </SettingsSection>
  )
}

/** Account email, password, two-step, biometrics and app lock: the content of the security screen. */
export function SecurityBody({ p }: { p: Profile & { user: NonNullable<Profile['user']> } }) {
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const t = p.t
  const tone = GROUP_TONE.security
  const user = p.user
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [twoFactorOffOpen, setTwoFactorOffOpen] = useState(false)
  const hasPassword = ((user.app_metadata?.providers as string[] | undefined) ?? ['email']).includes('email')
  const changeTwoFactor = async (next: boolean) => {
    if (!next) {
      setTwoFactorOffOpen(true)
      return
    }
    if ((await setTwoFactor(true)) === 'ok') p.store.updateSettings({ twoFactorEmailEnabled: true })
  }
  const userId = user.id
  // Warm the devices list while the screen is open, so the sheet opens with the answer instead of a wait.
  useEffect(() => {
    if (isNative()) void fetchDevices().then((next) => { if (next) writeCachedDevices(userId, next) })
  }, [userId])
  const memberSince = p.store.profile.createdAt
    ? new Date(p.store.profile.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <SettingsSection>
      <div className="space-y-0.5 px-4 py-3 text-sm">
        <p className="text-[var(--color-brand-text-primary)]">{user.email}</p>
        {memberSince ? <p className="text-xs text-[var(--color-brand-text-muted)]">{copy.security.memberSince} {memberSince}</p> : null}
      </div>
      <button
        type="button"
        data-raw-button-ok="settings row"
        data-setting-id="password"
        onClick={p.handlePasswordReset}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"
      >
        <SettingsChip icon={KeyRound} tone={tone} />
        <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{t.profile.changePassword}</span>
      </button>
      <SettingsSwitchRow
        id="twoFactor"
        label={t.settings.twoFaToggle}
        tone={tone}
        hint={t.settings.twoFaToggleHint}
        checked={p.store.settings.twoFactorEmailEnabled}
        onChange={(val) => void changeTwoFactor(val)}
      />
      <div data-setting-id="biometric"><BiometricLoginToggle userEmail={user.email} hasPassword={hasPassword} bare /></div>
      <div data-setting-id="appLock"><AppLockToggle userEmail={user.email} bare /></div>
      <SettingsRow icon={SETTING_ICONS.shield} tone={tone} title={copy.devices.title} subtitle={copy.devices.hint} onClick={() => setDevicesOpen(true)} settingId="devices" />
      <DevicesSheet open={devicesOpen} onClose={() => setDevicesOpen(false)} />
      <TwoFactorOffSheet
        open={twoFactorOffOpen}
        hasPassword={hasPassword}
        onClose={() => setTwoFactorOffOpen(false)}
        onTurnedOff={() => { p.store.updateSettings({ twoFactorEmailEnabled: false }); setTwoFactorOffOpen(false) }}
      />
    </SettingsSection>
  )
}
