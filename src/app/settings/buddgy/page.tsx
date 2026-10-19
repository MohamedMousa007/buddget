'use client'

import { AssistantBody } from '@/components/features/settings/rooms/AssistantBody'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSmsTrackingSection } from '@/components/features/settings/SettingsSmsTrackingSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useAuth } from '@/components/auth/AuthProvider'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

const caption = 'px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]'

/** The assistant's tips, learning and memories, then bank-text auto-tracking, on one screen. */
export default function SettingsBuddgyPage() {
  const copy = useSettingsHubCopy()
  const b = copy.buddgyPage
  const { user } = useAuth()

  return (
    <SettingsSubPageShell title={copy.rooms.buddgy.title}>
      <section className="space-y-3">
        <p className={caption}>{b.assistant}</p>
        <AssistantBody />
        <SettingsSection>
          <SettingsToggleRow id="voiceReadAloud" tone={ROOM_TONE.buddgy} hint={b.voiceHint} tag={b.deviceOnly} />
        </SettingsSection>
      </section>
      {user ? (
        <section className="space-y-3" data-setting-id="sms">
          <p className={caption}>{b.tracking}</p>
          <SettingsSmsTrackingSection />
        </section>
      ) : null}
    </SettingsSubPageShell>
  )
}
