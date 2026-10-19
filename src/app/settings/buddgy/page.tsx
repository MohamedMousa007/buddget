'use client'

import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useAuth } from '@/components/auth/AuthProvider'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

export default function SettingsBuddgyPage() {
  const copy = useSettingsHubCopy()
  const b = copy.buddgyPage
  const { user } = useAuth()
  const tone = ROOM_TONE.buddgy
  const tips = useSettingsStore((s) => s.buddgyNudges)
  const learning = useSettingsStore((s) => s.buddgyLearning)
  const memories = useFinanceStore((s) => s.buddgyMemories.length)

  return (
    <SettingsSubPageShell title={copy.rooms.buddgy.title}>
      <SettingsSection title={b.assistant}>
        <SettingsRow
          icon={SETTING_ICONS.buddgy}
          tone={tone}
          title={copy.items.tips.label}
          subtitle={b.assistantHint(tips, learning)}
          value={memories ? String(memories) : undefined}
          href="/settings/ai"
          settingId="memories"
        />
        <SettingsToggleRow id="voiceReadAloud" tone={tone} hint={b.voiceHint} tag={b.deviceOnly} />
      </SettingsSection>
      {user ? (
        <SettingsSection title={b.tracking}>
          <SettingsRow icon={SETTING_ICONS.message} tone={tone} title={copy.items.sms.label} subtitle={b.trackingHint} href="/settings/sms" settingId="sms" />
        </SettingsSection>
      ) : null}
    </SettingsSubPageShell>
  )
}
