/**
 * Logic hook for the SMS auto-tracking settings section.
 *
 * Handles:
 *   - toggling smsTrackingEnabled (store + push subscription)
 *   - fetching the user's ingest token + webhook URL
 *   - fetching recent sms_events
 *   - undo action for a recent event
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
import { KIND_TO_BADGE } from '@/lib/sms/transactionTypes'

export interface SmsEvent {
  /** Which table this row came from — routes undo to the correct endpoint. */
  source: 'event' | 'log'
  id: string
  sender: string
  bank_name: string | null
  transaction_type: string | null
  amount: number | null
  currency: string | null
  merchant: string | null
  clean_title: string | null
  badge_key: string | null
  expense_id: string | null
  income_id: string | null
  undo_expires_at: string | null
  received_at: string
  parsed_ok: boolean
  failure_code: string | null
}

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
  const [recentEvents, setRecentEvents] = useState<SmsEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [undoMessage, setUndoMessage] = useState<{ id: string; text: string } | null>(null)
  const [todayCount, setTodayCount] = useState(0)

  const isEnabled = settings.smsTrackingEnabled

  // Fetch token + recent events when enabled
  useEffect(() => {
    if (!isEnabled) return

    const fetchToken = async () => {
      const res = await apiFetchAuth('/api/sms/setup-token')
      if (res.ok) {
        const data = await res.json() as TokenInfo
        setTokenInfo(data)
      }
    }

    const fetchEvents = async () => {
      const supabase = createClient()
      // Merge both pipelines: iOS/webhook (sms_events) + Android AI (sms_parse_log).
      const [eventsRes, logRes] = await Promise.all([
        supabase
          .from('sms_events')
          .select('id, sender, bank_name, transaction_type, amount, currency, merchant, badge_key, expense_id, undo_expires_at, received_at, parse_ok')
          .eq('parse_ok', true)
          .eq('is_duplicate', false)
          .order('received_at', { ascending: false })
          .limit(15),
        supabase
          .from('sms_parse_log')
          .select('id, sender, bank_name, kind, amount, currency, merchant, clean_title, expense_id, income_id, parsed_ok, failure_code, received_at')
          .order('received_at', { ascending: false })
          .limit(15),
      ])

      const eventRows: SmsEvent[] = (eventsRes.data ?? []).map((e) => ({
        source: 'event',
        id: e.id,
        sender: e.sender,
        bank_name: e.bank_name,
        transaction_type: e.transaction_type,
        amount: e.amount,
        currency: e.currency,
        merchant: e.merchant,
        clean_title: null,
        badge_key: e.badge_key,
        expense_id: e.expense_id,
        income_id: null,
        undo_expires_at: e.undo_expires_at,
        received_at: e.received_at,
        parsed_ok: e.parse_ok,
        failure_code: null,
      }))

      const logRows: SmsEvent[] = (logRes.data ?? []).map((l) => ({
        source: 'log',
        id: l.id,
        sender: l.sender ?? '',
        bank_name: l.bank_name,
        transaction_type: l.kind,
        amount: l.amount,
        currency: l.currency,
        merchant: l.merchant,
        clean_title: l.clean_title,
        badge_key: l.kind ? (KIND_TO_BADGE[l.kind] ?? null) : null,
        expense_id: l.expense_id,
        income_id: l.income_id,
        undo_expires_at: null, // log rows have no artificial expiry
        received_at: l.received_at,
        parsed_ok: l.parsed_ok,
        failure_code: l.failure_code,
      }))

      const merged = [...eventRows, ...logRows]
        .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
        .slice(0, 15)
      setRecentEvents(merged)
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

    fetchToken()
    fetchEvents()
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
    }
  }, [])

  const rotateToken = useCallback(async () => {
    const res = await apiFetchAuth('/api/sms/setup-token', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
    }
  }, [])

  const undo = useCallback(async (event: SmsEvent) => {
    // sms_events rows keep their 5-min window; sms_parse_log rows have no expiry.
    if (event.source === 'event' && (!event.undo_expires_at || new Date(event.undo_expires_at) < new Date())) {
      setUndoMessage({ id: event.id, text: 'expired' })
      return
    }
    setUndoingId(event.id)
    try {
      const body = event.source === 'event'
        ? { smsEventId: event.id }
        : { parseLogId: event.id }
      const res = await apiFetchAuth('/api/sms/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { ok: boolean; expired?: boolean }
      if (data.expired) {
        setUndoMessage({ id: event.id, text: 'expired' })
      } else if (data.ok) {
        setUndoMessage({ id: event.id, text: 'success' })
        setRecentEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, expense_id: null, income_id: null, undo_expires_at: null } : e))
      }
    } finally {
      setUndoingId(null)
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
    recentEvents,
    undo,
    undoingId,
    undoMessage,
    iosDownloadUrl,
    todayCount,
  }
}
