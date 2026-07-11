'use client'

import { useEffect } from 'react'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsSmsTrackingSection } from '@/components/features/settings/SettingsSmsTrackingSection'
import { useAuth } from '@/components/auth/AuthProvider'
import { navigate } from '@/lib/navigation/navigate'
import { useT } from '@/lib/i18n'

export default function SettingsSmsPage() {
  const t = useT()
  const { user } = useAuth()

  useEffect(() => {
    if (user === null) navigate('/settings', { replace: true })
  }, [user])

  if (!user) return null

  return (
    <SettingsSubPageShell title={t.settings.hub.sms}>
      <SettingsSmsTrackingSection />
    </SettingsSubPageShell>
  )
}
