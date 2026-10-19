'use client'

import { useEffect } from 'react'
import { SettingsSmsTrackingSection } from '@/components/features/settings/SettingsSmsTrackingSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useAuth } from '@/components/auth/AuthProvider'
import { navigate } from '@/lib/navigation/navigate'
import { isIOS, isNative } from '@/lib/native/isNative'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

/** The iPhone Shortcut guide. Everywhere else SMS tracking is a switch on the settings page, so this just goes there. */
export default function SettingsSmsPage() {
  const t = useT()
  const { user } = useAuth()
  const guide = isNative() && isIOS()
  const setFocusId = useSettingsStore((s) => s.setSettingsFocusId)

  useEffect(() => {
    if (!user || !guide) {
      setFocusId('sms')
      navigate('/settings', { replace: true })
    }
  }, [user, guide, setFocusId])

  if (!user || !guide) return null

  return (
    <SettingsSubPageShell title={t.settings.hub.sms}>
      <SettingsSmsTrackingSection />
    </SettingsSubPageShell>
  )
}
