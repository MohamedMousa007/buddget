'use client'

import { useEffect } from 'react'
import { SettingsSmsTrackingSection } from '@/components/features/settings/SettingsSmsTrackingSection'
import { useAuth } from '@/components/auth/AuthProvider'
import { navigate } from '@/lib/navigation/navigate'
import { isIOS, isNative } from '@/lib/native/isNative'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** The iPhone Shortcut guide, straight at its first page. Everywhere else SMS tracking is a switch on the settings page, so this just goes there. */
export default function SettingsSmsPage() {
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

  return <SettingsSmsTrackingSection />
}
