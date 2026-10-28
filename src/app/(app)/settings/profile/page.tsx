'use client'

import { ProfileBody } from '@/components/features/settings/ProfileBody'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useProfilePage } from '@/hooks/useProfilePage'

export default function SettingsProfilePage() {
  const p = useProfilePage()
  return (
    <SettingsSubPageShell title={p.t.settings.hub.profile}>
      <ProfileBody p={p} />
    </SettingsSubPageShell>
  )
}
