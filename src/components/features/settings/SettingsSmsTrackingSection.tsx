'use client'

import { SmsIosSetupCard } from '@/components/features/settings/SmsIosSetupCard'
import { useSmsTracking } from '@/hooks/useSmsTracking'

/** The iPhone Shortcut guide and connection status; the on/off switch itself lives on the settings page. */
export function SettingsSmsTrackingSection() {
  const { completeIosSetup, setup, error } = useSmsTracking({ withDeviceSms: true })
  return <SmsIosSetupCard setup={setup} onSetupComplete={completeIosSetup} error={error} />
}
