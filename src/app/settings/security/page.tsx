'use client'

import { useEffect } from 'react'
import { DeleteAccountCta } from '@/components/features/settings/hub/DeleteAccountCta'
import { SecurityBody } from '@/components/features/settings/hub/SecurityCard'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useProfilePage } from '@/hooks/useProfilePage'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { navigate } from '@/lib/navigation/navigate'

/** Sign-in and security: password, two-step, biometrics, app lock, and account deletion at the bottom. */
export default function SettingsSecurityPage() {
  const copy = useSettingsHubCopy()
  const p = useProfilePage()
  const user = p.user

  useEffect(() => {
    if (user === null) navigate('/settings', { replace: true })
  }, [user])

  if (!user) return null

  return (
    <SettingsSubPageShell title={copy.security.title}>
      <SecurityBody p={{ ...p, user }} />
      <DeleteAccountCta p={p} />
    </SettingsSubPageShell>
  )
}
