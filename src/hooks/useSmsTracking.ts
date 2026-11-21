/**
 * Logic hook for the SMS auto-tracking settings section.
 *
 * Handles:
 *   - toggling smsTrackingEnabled (store + push subscription)
 *   - fetching the user's ingest token
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
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { fetchThisDeviceSms, setDeviceCollectsSms } from '@/lib/devices/client'
import { NO_DEVICE_FACTS, deriveSmsSetupState, iosSetUpHere, needsLegacyReading, type SmsDeviceFacts } from '@/lib/sms/setupState'
import { saveSmsToken, setSmsEnabled, setIosSetupCompleted, getSmsBridgeStatus, SMS_QUEUE_CHANGED_EVENT, type SmsBridgeStatus } from '@/lib/native/smsTracker'

export interface TokenInfo {
  token: string
}

/**
 * Lightweight "is SMS capture armed right now" read: the native bridge on
 * device, the synced setting on web. No token or Supabase work.
 */
export function useSmsArmed(): boolean {
  const smsTrackingEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const [armed, setArmed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isNative()) return
    let live = true
    const refresh = () => {
      void getSmsBridgeStatus().then((status) => {
        if (live) setArmed(status?.enabled ?? false)
      })
    }
    refresh()
    window.addEventListener(SMS_QUEUE_CHANGED_EVENT, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false
      window.removeEventListener(SMS_QUEUE_CHANGED_EVENT, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  // Until the native read lands, trust the synced intent so armed users never see a stale "turn on".
  return isNative() ? (armed ?? smsTrackingEnabled) : smsTrackingEnabled
}

/**
 * Newest account SMS that carries no device id (a phone on a token from before tokens were device-bound), refusal
 * rows excluded. Index scan on sms_parse_log_user_received_idx (EXPLAIN on live, 2026-11-20).
 */
async function fetchLegacyLastSms(userId: string): Promise<string | null> {
  const { data } = await createClient()
    .from('sms_parse_log')
    .select('received_at')
    .eq('user_id', userId)
    .is('device_id', null)
    .or('failure_code.is.null,failure_code.not.in.(device_blocked,invalid_body,invalid_json)')
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.received_at ?? null
}

/**
 * The iPhone setup claim (guide Finish or confirmed skip): stores the ingest token, then records the claim and arms.
 * Returns the token, or null when it could not be issued or stored; then nothing is claimed or armed (BDG-008).
 */
export async function claimIosSetup(uid: string | null): Promise<string | null> {
  if (!uid) return null
  const res = await apiFetchAuth('/api/sms/setup-token', { method: 'POST' }).catch(() => null)
  if (!res?.ok) return null
  const { token } = await res.json() as TokenInfo
  if (!token) return null
  await saveSmsToken(token, uid)
  const stored = await getSmsBridgeStatus()
  if (!stored?.tokenSaved || stored.tokenUserId !== uid) return null
  await setIosSetupCompleted(true)
  await setSmsEnabled(true)
  return token
}

/** `withDeviceSms` also reads this phone's server-side SMS facts (iPhone only), for the setup card and onboarding. */
export function useSmsTracking({ withDeviceSms = false }: { withDeviceSms?: boolean } = {}) {
  const t = useSettingsHubCopy().sms
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
  const [deviceSms, setDeviceSms] = useState<SmsDeviceFacts>(NO_DEVICE_FACTS)

  // Per-device truth: on native the bridge state is authoritative (a synced
  // setting from another device must not show "on" until this device is armed).
  // On web there is no bridge — the synced setting is the source.
  const isEnabled = isNative() ? deviceStatus?.enabled ?? false : settings.smsTrackingEnabled
  // iOS shows the switch once this phone has a setup claim or a Shortcut run (BDG-008; a token alone is not enough).
  // Both are device facts that survive account switches. Android/web always show it.
  const isSetup = isNative() && isIOS() ? iosSetUpHere(deviceStatus) : true

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

  const refreshDeviceSms = useCallback(async () => {
    if (!withDeviceSms || !isNative() || !isIOS()) return
    const own = await fetchThisDeviceSms()
    const uid = needsLegacyReading(own) ? await currentUserId() : null
    setDeviceSms({ firstSmsAt: own?.firstAt ?? null, lastSmsAt: own?.lastAt ?? null, legacyLastSmsAt: uid ? await fetchLegacyLastSms(uid) : null })
  }, [withDeviceSms, currentUserId])

  useEffect(() => {
    void refreshDeviceSms()
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshDeviceSms() }
    document.addEventListener('visibilitychange', onVisible)
    const onQueue = () => { void refreshDeviceSms() }
    window.addEventListener(SMS_QUEUE_CHANGED_EVENT, onQueue)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(SMS_QUEUE_CHANGED_EVENT, onQueue)
    }
  }, [refreshDeviceSms])

  useEffect(() => {
    void refreshStatus()
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshStatus() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshStatus])

  // Fetch token + connection status when enabled
  useEffect(() => {
    if (!isEnabled) return

    const fetchTokenOnMount = async () => {
      const res = await apiFetchAuth('/api/sms/setup-token', { method: 'POST' })
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
      const uid = await currentUserId()
      if (!uid) return
      const { data } = await supabase
        .from('sms_parse_log')
        .select('received_at')
        .eq('user_id', uid)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setLastReceivedAt(data?.received_at ?? null)
    }

    const fetchTodayCount = async () => {
      const supabase = createClient()
      const uid = await currentUserId()
      if (!uid) return
      const { data } = await supabase
        .from('sms_parse_today')
        .select('parsed_count_today')
        .eq('user_id', uid)
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
        const { checkSmsPermission, requestSmsPermission, ensureIngestToken, stopSMSTracking, revokeOwnIngestToken } =
          await import('@/lib/native/smsTracker')
        if (value) {
          const alreadyGranted = await checkSmsPermission()
          const granted = alreadyGranted || (await requestSmsPermission())
          if (!granted) {
            setError(t.permissionDenied)
            return // user denied — leave switch OFF
          }
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
          await revokeOwnIngestToken()
          setError(null)
        }
        updateSettings({ smsTrackingEnabled: value })
        const owner = await currentUserId()
        if (owner) void setDeviceCollectsSms(owner, value)
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
          const res = await apiFetchAuth('/api/sms/setup-token', { method: 'POST' })
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
          await (await import('@/lib/native/smsTracker')).revokeOwnIngestToken()
          setError(null)
        }
        updateSettings({ smsTrackingEnabled: value })
        const owner = await currentUserId()
        if (owner) void setDeviceCollectsSms(owner, value)
        return
      }

      // Web has no OS push — the toggle just persists the preference; web users
      // see SMS results in the in-app notification center.
      updateSettings({ smsTrackingEnabled: value })
    } finally {
      void refreshStatus()
      setLoading(false)
    }
  }, [updateSettings, refreshStatus, currentUserId, t])

  /**
   * Called when the user finishes the iOS Shortcut guide or confirms "Shortcuts already exist": arm the bridge
   * (token + enabled), record the claim (reveals the switch, ON), and sync the cross-device intent.
   * False when the token could not be fetched: then nothing is claimed or armed and the guide stays open.
   */
  const completeIosSetup = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const uid = await currentUserId()
      const token = await claimIosSetup(uid)
      if (!token || !uid) {
        setError(t.setupFailed)
        return false
      }
      setTokenInfo({ token })
      setError(null)
      updateSettings({ smsTrackingEnabled: true })
      void setDeviceCollectsSms(uid, true)
      await refreshStatus()
      return true
    } finally {
      setLoading(false)
    }
  }, [updateSettings, refreshStatus, currentUserId, t])

  const fetchToken = useCallback(async () => {
    const uid = await currentUserId()
    const res = await apiFetchAuth('/api/sms/setup-token', { method: 'POST' })
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
    permission: deviceStatus?.permission,
    /** The five iPhone facts (BDG-008). Server facts are empty unless `withDeviceSms` is set. */
    setup: deriveSmsSetupState(settings.smsTrackingEnabled, deviceStatus, deviceSms, Date.now()),
  }
}
