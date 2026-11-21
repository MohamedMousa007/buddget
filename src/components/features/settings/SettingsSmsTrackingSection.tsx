'use client'

import SmsTrackingGuide from '@/components/onboarding/SmsTrackingGuide'
import { useSmsTracking } from '@/hooks/useSmsTracking'

/** The iPhone Shortcut guide, opened at its first page. Status and the switch live on the settings page (SmsCard). */
export function SettingsSmsTrackingSection() {
  const { completeIosSetup, setup, error } = useSmsTracking({ withDeviceSms: true })
  return <SmsTrackingGuide onComplete={completeIosSetup} verified={setup.verified} error={error} />
}
