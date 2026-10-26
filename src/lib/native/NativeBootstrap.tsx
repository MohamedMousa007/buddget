'use client'

import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isNative } from '@/lib/native/isNative'
import { registerPushNotifications } from '@/lib/native/pushNotifications'
import { cleanupOldReceiptImages } from '@/lib/native/receiptImages'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { heldRecords } from '@/lib/onboarding/held'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { onboardingState } from '@/lib/onboarding/eligibility'
import { deferPushPrompt } from '@/lib/onboarding/pushPolicy'
import { useNotifyDecision } from '@/hooks/useNotifyDecision'
import { reportThisDevice } from '@/lib/devices/notify'

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
  const decide = useNotifyDecision()

  // Read the token via a ref at call time. Keying the effect on access_token
  // re-ran the ENTIRE bootstrap (permission request, FCM register, SMS resume)
  // on every token refresh — once per hour and on each foreground churn.
  const tokenRef = useRef<string | null>(null)
  useEffect(() => {
    tokenRef.current = session?.access_token ?? null
  }, [session?.access_token])

  const userId = session?.user?.id ?? null
  const flagOn = useFeatureFlag('onboarding_v1', !!userId)
  // The first sync decides whether this is a new account that should be asked inside the setup journey instead.
  const synced = useSettingsStore((s) => !!userId && s.serverSyncedFor === userId)
  const bootstrapped = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return
    if (!isNative()) return
    if (!synced || flagOn === null) return
    if (bootstrapped.current === userId) return
    bootstrapped.current = userId

    void cleanupOldReceiptImages()

    void (async () => {
      const accessToken = tokenRef.current
      if (!accessToken) return
      try {
        if (useSettingsStore.getState().pushOptOut) return
        const f = useFinanceStore.getState()
        const record = f.profile.financialProfile?.onboarding
        const journeyOpen = onboardingState({
          flagOn, profileLoaded: true, record,
          ...heldRecords(f),
        }) !== 'hidden'
        if (deferPushPrompt(record, journeyOpen, Date.now())) return
        // A phone that is not the main one asks first when another phone already gets notifications.
        const decision = await decide()
        if (!decision.proceed) {
          useSettingsStore.getState().setPushOptOut(true)
          await reportThisDevice(false)
          return
        }
        await registerPushNotifications({
          accessToken,
          userId,
          locale: language,
          notify: decision.explicit ? true : undefined,
        })
      } catch (e) {
        console.error('[native-bootstrap] push register failed', e)
      }
      // SMS bridge arming lives in AppShell's SmsStartupSync — the single
      // path that writes the native token (ingest token only, never the JWT).
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, synced, flagOn]) // once per signed-in user, after the first sync — token read from ref, language at first-run value

  return null
}
