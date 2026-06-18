'use client'

import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { resumeSmsTrackingIfEnabled } from '@/lib/native/smsTracker'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

interface NativeBootstrapProps {
  session: Session | null
}

/**
 * Runs after a Supabase session is available inside the Capacitor shell:
 *
 *  1. Registers the device for FCM/APNS push (`/api/push/register`), re-running
 *     on account switch (keyed by userId).
 *  2. On Android, kicks off the SMS retriever loop (Egypt-first bank parsing).
 *
 * No-op on web (PWA / desktop browsers) — web has no OS push and uses the
 * in-app notification center + the iOS-Shortcut SMS bridge instead.
 */
export function NativeBootstrap({ session }: NativeBootstrapProps) {
  const language = useFinanceStore((s) => s.settings.language)

  useEffect(() => {
    if (!session?.access_token || !session.user?.id) return
    if (!isNative()) return

    let cancelled = false

    void (async () => {
      const accessToken = session.access_token
      try {
        await registerPushNotifications({
          accessToken,
          userId: session.user.id,
          locale: language,
        })
      } catch (e) {
        console.error('[native-bootstrap] push register failed', e)
      }
      if (cancelled) return
      if (isAndroid()) {
        try {
          // Resume only if this device already has tracking ON — never auto-enable
          // on a fresh sign-in (default OFF per device until the user opts in).
          await resumeSmsTrackingIfEnabled(accessToken)
        } catch (e) {
          console.error('[native-bootstrap] sms tracking resume failed', e)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  return null
}
