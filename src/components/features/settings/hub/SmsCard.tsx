'use client'

import { AlertTriangle } from 'lucide-react'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { isIOS, isNative } from '@/lib/native/isNative'

/** SMS tracking as one switch on the settings page. Only an iPhone that has not been set up opens the guide screen. */
export function SmsCard() {
  const copy = useSettingsHubCopy()
  const { isEnabled, isSetup, toggle, loading, error } = useSmsTracking()
  const needsGuide = isNative() && isIOS() && !isSetup
  const tone = GROUP_TONE.autoTrack

  return (
    <SettingsSection title={copy.groupName.autoTrack}>
      {needsGuide ? (
        <SettingsRow icon={SETTING_ICONS.message} tone={tone} title={copy.sms.title} subtitle={copy.sms.iosHint} value={copy.sms.guide} href="/settings/sms" settingId="sms" />
      ) : (
        <SettingsSwitchRow id="sms" label={copy.sms.title} tone={tone} hint={isEnabled ? copy.sms.on : copy.sms.hint} checked={isEnabled} onChange={(next) => void toggle(next)} disabled={loading} />
      )}
      {error ? (
        <p className="flex items-start gap-2 px-4 py-3 text-xs text-[var(--color-brand-amber)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </SettingsSection>
  )
}
