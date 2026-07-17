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
import { isNative, isAndroid, isIOS } from '@/lib/native/isNative'
import { createClient } from '@/lib/supabase/client'
import { apiFetchAuth } from '@/lib/apiBase'
import { saveSmsToken, setSmsEnabled, setIosSetupCompleted, getSmsBridgeStatus, type SmsBridgeStatus } from '@/lib/native/smsTracker'

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
  const [deviceStatus, setDeviceStatus] = useState<SmsBridgeStatus | null>(null)

  // Per-device truth: on native the bridge state is authoritative (a synced
  // setting from another device must not show "on" until this device is armed).
  // On web there is no bridge — the synced setting is the source.
  const isEnabled = isNative() ? deviceStatus?.enabled ?? false : settings.smsTrackingEnabled
  // iOS shows the switch once the device is WIRED (a Shortcut exists here), which
  // survives account switches — so switching accounts on a set-up phone never
  // regresses to the setup CTA. Android/web always show it.
  const isSetup = isNative() && isIOS() ? deviceStatus?.wired ?? false : true

  const refreshStatus = useCallback(async () => {
    if (!isNative()) return
    setDeviceStatus(await getSmsBridgeStatus())
  }, [])

  // Current account id — owner-stamps the natively stored ingest token so an
  // account switch can detect and drop a token that belongs to the old user.
  const currentUserId = useCallback(async (): Promise<string | null> => {
    const { data } = await createClient().auth.getSession()
    return data.session?.user?.id ?? null
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  // Fetch token + connection status when enabled
  useEffect(() => {
    if (!isEnabled) return

    const fetchTokenOnMount = async () => {
      const res = await apiFetchAuth('/api/sms/setup-token')
      if (res.ok) {
        const data = await res.json() as TokenInfo
        setTokenInfo(data)
        // Save the non-expiring ingest token natively (Android SmsForwardWorker /
        // iOS CatchBankSmsIntent) so the bridge survives the 1-hour JWT TTL.
        const uid = await currentUserId()
        if (isNative() && uid) void saveSmsToken(data.token, uid)
      }
    }

    // Newest received SMS for THIS account — the "bridge is alive" signal for the
    // iOS pill. Scoped by user_id so a multi-device account never reads another
    // phone's forwarded SMS as this device's connection.
    const fetchLastReceived = async () => {
      const supabase = createClient()
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes?.user) return
      const { data } = await supabase
        .from('sms_parse_log')
        .select('received_at')
        .eq('user_id', userRes.user.id)
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
  }, [isEnabled, currentUserId])

  const toggle = useCallback(async (value: boolean) => {
    setLoading(true)
    try {
      // Android native: OS permission must be confirmed before enabling.
      // The switch only flips green after the grant dialog resolves 'granted'.
      if (isNative() && isAndroid()) {
        const { checkSmsPermission, requestSmsPermission, ensureIngestToken, stopSMSTracking } =
          await import('@/lib/native/smsTracker')
        if (value) {
          const alreadyGranted = await checkSmsPermission()
          const granted = alreadyGranted || (await requestSmsPermission())
          if (!granted) return // user denied — leave switch OFF
          // Store the non-expiring ingest token (never the 1-hour JWT), then
          // flip the native gate — same order as the iOS path below.
          const session = await createClient().auth.getSession()
          const armed = await ensureIngestToken(
            session.data.session?.access_token ?? '',
            session.data.session?.user?.id ?? '',
          )
          if (!armed) {
            setError('SMS tracking failed to start. Please check your connection and try again.')
            return // do not flip switch on
          }
          await setSmsEnabled(true)
          setError(null)
        } else {
          await stopSMSTracking()
          setError(null)
        }
        updateSettings({ smsTrackingEnabled: value })
        return
      }

      // iOS native: arm the CatchBankSmsIntent bridge — persist the
      // non-expiring ingest token (never the 1-hour JWT) and flip the
      // native enabled gate the App Intent checks before forwarding.
      if (isNative() && isIOS()) {
        if (value) {
          // Arm only if the token actually lands — mirror the Android guard, so a
          // failed fetch never flips the switch green over an absent/stale token.
          const uid = await currentUserId()
          const res = await apiFetchAuth('/api/sms/setup-token')
          if (!res.ok || !uid) {
            setError('SMS tracking failed to start. Please check your connection and try again.')
            return
          }
          const data = await res.json() as TokenInfo
          setTokenInfo(data)
          await saveSmsToken(data.token, uid)
          await setSmsEnabled(true)
          setError(null)
        } else {
          await setSmsEnabled(false)
          setError(null)
        }
        updateSettings({ smsTrackingEnabled: value })
        return
      }

      // Web has no OS push — the toggle just persists the preference; web users
      // see SMS results in the in-app notification center.
      updateSettings({ smsTrackingEnabled: value })
    } finally {
      void refreshStatus()
      setLoading(false)
    }
  }, [updateSettings, refreshStatus])

  /**
   * Called when the user finishes the iOS Shortcut setup guide: arm the bridge
   * (token + enabled), mark setup complete (reveals the switch, ON), and sync
   * the cross-device intent. Returns once the device status reflects it.
   */
  const completeIosSetup = useCallback(async () => {
    setLoading(true)
    try {
      const uid = await currentUserId()
      const res = await apiFetchAuth('/api/sms/setup-token')
      if (res.ok && uid) {
        const data = await res.json() as TokenInfo
        setTokenInfo(data)
        await saveSmsToken(data.token, uid)
      }
      await setIosSetupCompleted(true)
      await setSmsEnabled(true)
      updateSettings({ smsTrackingEnabled: true })
      await refreshStatus()
    } finally {
      setLoading(false)
    }
  }, [updateSettings, refreshStatus, currentUserId])

  const fetchToken = useCallback(async () => {
    const uid = await currentUserId()
    const res = await apiFetchAuth('/api/sms/setup-token')
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
      if (isNative() && uid) void saveSmsToken(data.token, uid)
    }
  }, [currentUserId])

  const rotateToken = useCallback(async () => {
    const uid = await currentUserId()
    const res = await apiFetchAuth('/api/sms/setup-token', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
      if (isNative() && uid) void saveSmsToken(data.token, uid)
    }
  }, [currentUserId])

  return {
    isEnabled,
    isSetup,
    pendingCount: deviceStatus?.pendingCount ?? 0,
    toggle,
    completeIosSetup,
    refreshStatus,
    loading,
    error,
    tokenInfo,
    fetchToken,
    rotateToken,
    lastReceivedAt,
    todayCount,
  }
}
