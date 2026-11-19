'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { isIOS, isNative } from '@/lib/native/isNative'

/** SMS tracking as one switch on the settings page; `children` are more rows of the same group. An iPhone opens the Shortcut guide first, and keeps a row back to it once set up. */
export function SmsCard({ title, children }: { title?: string; children?: ReactNode }) {
  const copy = useSettingsHubCopy()
  const { isEnabled, isSetup, toggle, loading, error, permission } = useSmsTracking()
  const iosGuide = isNative() && isIOS()
  const needsGuide = iosGuide && !isSetup
  const notice = error ?? (isEnabled && permission === false ? copy.sms.permissionOff : null)
  const tone = GROUP_TONE.autoTrack

  return (
    <SettingsSection title={title ?? copy.groupName.autoTrack}>
      {needsGuide ? (
        <SettingsRow icon={SETTING_ICONS.message} tone={tone} title={copy.sms.title} subtitle={copy.sms.iosHint} value={copy.sms.guide} href="/settings/sms" settingId="sms" />
      ) : (
        <SettingsSwitchRow id="sms" label={copy.sms.title} tone={tone} hint={isEnabled ? copy.sms.on : copy.sms.hint} checked={isEnabled} onChange={(next) => void toggle(next)} disabled={loading} />
      )}
      {iosGuide && !needsGuide ? (
        <SettingsRow icon={SETTING_ICONS.message} tone={tone} title={copy.sms.guideRow} subtitle={copy.sms.guideRowHint} href="/settings/sms" settingId="sms-guide" />
      ) : null}
      {notice ? (
        <p className="flex items-start gap-2 px-4 py-3 text-xs text-[var(--color-brand-amber)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </p>
      ) : null}
      {children}
    </SettingsSection>
  )
}
