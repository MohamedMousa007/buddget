'use client'

import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

const APP_VERSION = '1.0'

export default function SettingsHelpPage() {
  const copy = useSettingsHubCopy()
  const h = copy.helpPage

  return (
    <SettingsSubPageShell title={copy.rooms.help.title}>
      <SettingsSection title={h.support}>
        <SettingsRow icon={SETTING_ICONS.help} title={copy.items.feedback.label} subtitle={h.feedbackHint} href="/settings/feedback" settingId="feedback" />
      </SettingsSection>
      <SettingsSection title={h.legal}>
        <SettingsRow icon={SETTING_ICONS.file} title={copy.items.terms.label} href="/legal/terms" settingId="terms" />
        <SettingsRow icon={SETTING_ICONS.file} title={copy.items.privacy.label} href="/legal/privacy" settingId="privacy" />
      </SettingsSection>
      <SettingsSection title={h.about}>
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
          <span className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{h.version}</span>
          <span className="font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">{APP_VERSION}</span>
        </div>
      </SettingsSection>
    </SettingsSubPageShell>
  )
}
