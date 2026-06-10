/**
 * Logic hook for the SMS auto-tracking settings section.
 *
 * Handles:
 *   - toggling smsTrackingEnabled (store + push subscription)
 *   - fetching the user's ingest token + webhook URL
 *   - last-received timestamp (feeds the iOS connection pill)
 *   - token rotation
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { subscribeToPush, unsubscribeFromPush } from '@/lib/notifications/webPushSubscribe'
import { requestPushPermission } from '@/lib/notifications/pushNotifications'
import { isNative, isAndroid } from '@/lib/native/isNative'
import { createClient } from '@/lib/supabase/client'
import { apiFetchAuth, apiUrl } from '@/lib/apiBase'
import { saveSmsToken } from '@/lib/native/smsTracker'

export interface TokenInfo {
  token: string
  webhookUrl: string
}

export function useSmsTracking() {
  const { settings, updateSettings } = useFinanceStore(
    useShallow((s) => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
    })),
  )

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null)
  const [todayCount, setTodayCount] = useState(0)

  const isEnabled = settings.smsTrackingEnabled

  // Fetch token + connection status when enabled
  useEffect(() => {
    if (!isEnabled) return

    const fetchTokenOnMount = async () => {
      const res = await apiFetchAuth('/api/sms/setup-token')
      if (res.ok) {
        const data = await res.json() as TokenInfo
        setTokenInfo(data)
        // Save the non-expiring ingest token so SmsForwardWorker always has a valid
        // credential even after the Supabase JWT expires (1-hour TTL).
        if (isNative() && isAndroid()) void saveSmsToken(data.token)
      }
    }

    // Newest received SMS — the "bridge is alive" signal for the iOS pill.
    const fetchLastReceived = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sms_parse_log')
        .select('received_at')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setLastReceivedAt(data?.received_at ?? null)
    }

    const fetchTodayCount = async () => {
      const supabase = createClient()
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes?.user) return
      const { data } = await supabase
        .from('sms_parse_today')
        .select('parsed_count_today')
        .eq('user_id', userRes.user.id)
        .maybeSingle()
      setTodayCount((data as { parsed_count_today?: number } | null)?.parsed_count_today ?? 0)
    }

    fetchTokenOnMount()
    void fetchLastReceived()
    void fetchTodayCount()
  }, [isEnabled])

  const toggle = useCallback(async (value: boolean) => {
    setLoading(true)
    try {
      // Android native: OS permission must be confirmed before enabling.
      // The switch only flips green after the grant dialog resolves 'granted'.
      if (isNative() && isAndroid()) {
        const { checkSmsPermission, requestSmsPermission, startSMSTracking, stopSMSTracking } =
          await import('@/lib/native/smsTracker')
        if (value) {
          const alreadyGranted = await checkSmsPermission()
          const granted = alreadyGranted || (await requestSmsPermission())
          if (!granted) return // user denied — leave switch OFF
          const session = await createClient().auth.getSession()
          try {
            await startSMSTracking(session.data.session?.access_token ?? '')
            setError(null)
          } catch {
            setError('SMS tracking failed to start. Please check permissions and try again.')
            return // do not flip switch on
          }
        } else {
          await stopSMSTracking()
          setError(null)
        }
        updateSettings({ smsTrackingEnabled: value })
        return
      }

      // Web Push requires Service Workers — not available in Capacitor WebView.
      // On iOS native, skip push entirely and just flip the Zustand flag.
      if (!isNative()) {
        if (value) {
          try {
            const granted = await requestPushPermission()
            if (granted) await subscribeToPush()
          } catch {
            // Push setup failed — SMS toggle continues regardless
          }
        } else {
          try { await unsubscribeFromPush() } catch { /* noop */ }
        }
      }
      updateSettings({ smsTrackingEnabled: value })
    } finally {
      setLoading(false)
    }
  }, [updateSettings])

  const fetchToken = useCallback(async () => {
    const res = await apiFetchAuth('/api/sms/setup-token')
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
      if (isNative() && isAndroid()) void saveSmsToken(data.token)
    }
  }, [])

  const rotateToken = useCallback(async () => {
    const res = await apiFetchAuth('/api/sms/setup-token', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
      if (isNative() && isAndroid()) void saveSmsToken(data.token)
    }
  }, [])

  // Absolute URL so the download opens against the deployed origin in the
  // Capacitor iOS WebView (page origin there is https://localhost → relative
  // paths would 404). apiUrl() returns the path unchanged on web.
  const iosDownloadUrl = tokenInfo
    ? apiUrl(`/api/sms/shortcut/${tokenInfo.token}`)
    : null

  return {
    isEnabled,
    toggle,
    loading,
    error,
    tokenInfo,
    fetchToken,
    rotateToken,
    lastReceivedAt,
    iosDownloadUrl,
    todayCount,
  }
}
