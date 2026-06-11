'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsSmsTrackingSection } from '@/components/features/settings/SettingsSmsTrackingSection'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'

export default function SettingsSmsPage() {
  const t = useT()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user === null) router.replace('/settings')
  }, [user, router])

  if (!user) return null

  return (
    <SettingsSubPageShell title={t.settings.hub.sms}>
      <SettingsSmsTrackingSection />
    </SettingsSubPageShell>
  )
}
