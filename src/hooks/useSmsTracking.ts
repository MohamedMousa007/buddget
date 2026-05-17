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
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { subscribeToPush, unsubscribeFromPush } from '@/lib/notifications/webPushSubscribe'
import { requestPushPermission } from '@/lib/notifications/pushNotifications'
import { createClient } from '@/lib/supabase/client'

export interface SmsEvent {
  id: string
  sender: string
  bank_name: string | null
  transaction_type: string | null
  amount: number | null
  currency: string | null
  merchant: string | null
  badge_key: string | null
  expense_id: string | null
  undo_expires_at: string | null
  received_at: string
  parse_ok: boolean
}

export interface TokenInfo {
  token: string
  webhookUrl: string
}

export function useSmsTracking() {
  const { settings, updateSettings } = useFinanceStore((s) => ({
    settings: s.settings,
    updateSettings: s.updateSettings,
  }))

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [recentEvents, setRecentEvents] = useState<SmsEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [undoMessage, setUndoMessage] = useState<{ id: string; text: string } | null>(null)

  const isEnabled = settings.smsTrackingEnabled

  // Fetch token + recent events when enabled
  useEffect(() => {
    if (!isEnabled) return

    const fetchToken = async () => {
      const res = await fetch('/api/sms/setup-token')
      if (res.ok) {
        const data = await res.json() as TokenInfo
        setTokenInfo(data)
      }
    }

    const fetchEvents = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sms_events')
        .select('id, sender, bank_name, transaction_type, amount, currency, merchant, badge_key, expense_id, undo_expires_at, received_at, parse_ok')
        .eq('parse_ok', true)
        .eq('is_duplicate', false)
        .order('received_at', { ascending: false })
        .limit(10)
      setRecentEvents((data as SmsEvent[]) ?? [])
    }

    fetchToken()
    fetchEvents()
  }, [isEnabled])

  const toggle = useCallback(async (value: boolean) => {
    setLoading(true)
    try {
      if (value) {
        const granted = await requestPushPermission()
        if (granted) await subscribeToPush()
      } else {
        await unsubscribeFromPush()
      }
      updateSettings({ smsTrackingEnabled: value })
    } finally {
      setLoading(false)
    }
  }, [updateSettings])

  const fetchToken = useCallback(async () => {
    const res = await fetch('/api/sms/setup-token')
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
    }
  }, [])

  const rotateToken = useCallback(async () => {
    const res = await fetch('/api/sms/setup-token', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json() as TokenInfo
      setTokenInfo(data)
    }
  }, [])

  const undo = useCallback(async (event: SmsEvent) => {
    if (!event.undo_expires_at || new Date(event.undo_expires_at) < new Date()) {
      setUndoMessage({ id: event.id, text: 'expired' })
      return
    }
    setUndoingId(event.id)
    try {
      const res = await fetch('/api/sms/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEventId: event.id }),
      })
      const data = await res.json() as { ok: boolean; expired?: boolean }
      if (data.expired) {
        setUndoMessage({ id: event.id, text: 'expired' })
      } else if (data.ok) {
        setUndoMessage({ id: event.id, text: 'success' })
        setRecentEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, expense_id: null, undo_expires_at: null } : e))
      }
    } finally {
      setUndoingId(null)
    }
  }, [])

  const iosDownloadUrl = tokenInfo
    ? `/api/sms/shortcut/${tokenInfo.token}`
    : null

  return {
    isEnabled,
    toggle,
    loading,
    tokenInfo,
    fetchToken,
    rotateToken,
    recentEvents,
    undo,
    undoingId,
    undoMessage,
    iosDownloadUrl,
  }
}
