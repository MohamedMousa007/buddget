'use client'

import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { startSMSTracking } from '@/lib/native/smsTracker'

interface NativeBootstrapProps {
  session: Session | null
}

/**
 * Runs once after a Supabase session is available inside the Capacitor shell:
 *
 *  1. Registers the device for FCM/APNS push (`/api/push/register`).
 *  2. On Android, kicks off the SMS retriever loop (Egypt-first bank parsing).
 *
 * No-op on web (PWA / desktop browsers) — those paths use VAPID web push and
 * the iOS-Shortcut SMS bridge instead.
 */
export function NativeBootstrap({ session }: NativeBootstrapProps) {
  useEffect(() => {
    if (!session?.access_token) return
    if (!isNative()) return

    let cancelled = false

    void (async () => {
      const accessToken = session.access_token
      try {
        await registerPushNotifications({
          accessToken,
          locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
        })
      } catch (e) {
        console.error('[native-bootstrap] push register failed', e)
      }
      if (cancelled) return
      if (isAndroid()) {
        try {
          await startSMSTracking(accessToken)
        } catch (e) {
          console.error('[native-bootstrap] sms tracking failed', e)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  return null
}
