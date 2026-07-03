'use client'

import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { resumeSmsTrackingIfEnabled } from '@/lib/native/smsTracker'
import { cleanupOldReceiptImages } from '@/lib/native/receiptImages'
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

  // Read the token via a ref at call time. Keying the effect on access_token
  // re-ran the ENTIRE bootstrap (permission request, FCM register, SMS resume)
  // on every token refresh — once per hour and on each foreground churn.
  const tokenRef = useRef<string | null>(null)
  useEffect(() => {
    tokenRef.current = session?.access_token ?? null
  }, [session?.access_token])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return
    if (!isNative()) return

    let cancelled = false

    void cleanupOldReceiptImages()

    void (async () => {
      const accessToken = tokenRef.current
      if (!accessToken) return
      try {
        await registerPushNotifications({
          accessToken,
          userId,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]) // once per signed-in user — token read from ref, language at first-run value

  return null
}
