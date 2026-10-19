'use client'

import { Card } from '@/components/ui/card'
import { AccountBody } from '@/components/features/settings/rooms/AccountBody'
import { ProfileBody } from '@/components/features/settings/rooms/ProfileBody'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useProfilePage } from '@/hooks/useProfilePage'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

const caption = 'px-1 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]'

/** Profile and account on one screen: who you are, then how you sign in. */
export default function SettingsYouPage() {
  const copy = useSettingsHubCopy()
  const p = useProfilePage()
  const user = p.user

  return (
    <SettingsSubPageShell title={copy.rooms.you.title}>
      <section data-setting-id="profile">
        <p className={caption}>{p.t.settings.hub.profile}</p>
        <ProfileBody p={p} />
      </section>
      {user ? (
        <section data-setting-id="account" className="space-y-4">
          <p className={caption}>{copy.you.security}</p>
          <AccountBody p={{ ...p, user }} />
        </section>
      ) : (
        <Card padding="md" variant="brand" className="text-sm text-[var(--color-brand-primary-ink)]">{copy.you.signedOutHint}</Card>
      )}
    </SettingsSubPageShell>
  )
}
