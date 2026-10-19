'use client'

import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { FeedbackBody } from '@/components/features/settings/rooms/FeedbackBody'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

const APP_VERSION = '1.0'

export default function SettingsHelpPage() {
  const copy = useSettingsHubCopy()
  const h = copy.helpPage

  return (
    <SettingsSubPageShell title={copy.rooms.help.title}>
      <section className="space-y-3" data-setting-id="feedback">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{h.support}</p>
        <p className="px-1 text-xs text-[var(--color-brand-text-muted)]">{h.feedbackHint}</p>
        <FeedbackBody />
      </section>
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
