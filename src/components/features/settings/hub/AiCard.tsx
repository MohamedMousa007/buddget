'use client'

import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** Buddgy and AI: tips, learning, reading answers aloud, and the way into Memory. */
export function AiCard() {
  const copy = useSettingsHubCopy()
  const tone = GROUP_TONE.ai
  const count = useFinanceStore((s) => s.buddgyMemories.length)
  return (
    <SettingsSection title={copy.groupName.ai}>
      <SettingsToggleRow id="tips" tone={tone} hint={copy.ai.tipsHint} />
      <SettingsToggleRow id="learning" tone={tone} hint={copy.ai.learningHint} />
      <SettingsToggleRow id="voiceReadAloud" tone={tone} hint={copy.ai.voiceHint} tag={copy.ai.deviceOnly} />
      <SettingsRow
        icon={SETTING_ICONS.brain}
        tone={tone}
        title={copy.items.memories.label}
        subtitle={copy.ai.memoryHint}
        value={count ? String(count) : undefined}
        href="/settings/memory"
        settingId="memories"
      />
    </SettingsSection>
  )
}
