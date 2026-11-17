'use client'

import { ProfileMemberHead } from '@/components/features/settings/ProfileMemberHead'
import { ProfileBody } from '@/components/features/settings/ProfileBody'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useProfilePage } from '@/hooks/useProfilePage'

export default function SettingsProfilePage() {
  const p = useProfilePage()
  return (
    <SettingsSubPageShell title={p.t.settings.hub.profile}>
      <ProfileMemberHead name={p.displayName} avatarSrc={p.avatarSrc} />
      <ProfileBody p={p} />
    </SettingsSubPageShell>
  )
}
