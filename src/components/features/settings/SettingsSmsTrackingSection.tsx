'use client'

import { useEffect, useState } from 'react'
import SmsTrackingGuide from '@/components/onboarding/SmsTrackingGuide'
import { SmsSetupGuide } from '@/components/onboarding/sms/SmsSetupGuide'
import { readGuideStart, setGuideStart } from '@/components/onboarding/sms/guideLaunch'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { guideVariantFor, useIosMajor } from '@/lib/native/iosVersion'

/** Archived keyword guide, kept for older iPhones until the owner retires it (NEXT_PUBLIC_SMS_GUIDE_CLASSIC=1). */
const CLASSIC_GUIDE = process.env.NEXT_PUBLIC_SMS_GUIDE_CLASSIC === '1'

/** The iPhone setup guide, matched to this phone's iOS version. Status and the switch live on the settings page (SmsCard). */
export function SettingsSmsTrackingSection() {
  const { completeIosSetup, setup, error } = useSmsTracking({ withDeviceSms: true })
  const major = useIosMajor()
  const [start] = useState(readGuideStart)
  // A later plain visit opens at the branded screen again.
  useEffect(() => () => setGuideStart('intro'), [])
  if (CLASSIC_GUIDE) return <SmsTrackingGuide onComplete={completeIosSetup} verified={setup.verified} error={error} />
  if (major === undefined) return null
  return <SmsSetupGuide variant={guideVariantFor(major)} start={start} onComplete={completeIosSetup} error={error} />
}
