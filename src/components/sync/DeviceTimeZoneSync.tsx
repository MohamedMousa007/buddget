'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deviceTimeZone, timeZoneUpdate } from '@/lib/time/deviceTimeZone'

/** Keeps settings.timezone equal to the device zone once data has loaded, and again whenever the app returns to the foreground. */
export function DeviceTimeZoneSync() {
  const dataReady = useFinanceStore((s) => s.dataReady)

  useEffect(() => {
    if (!dataReady) return
    const sync = () => {
      const { settings, updateSettings } = useFinanceStore.getState()
      const next = timeZoneUpdate(settings.timezone, deviceTimeZone())
      if (next) updateSettings({ timezone: next })
    }
    sync()
    const onVisible = () => document.visibilityState === 'visible' && sync()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [dataReady])

  return null
}
