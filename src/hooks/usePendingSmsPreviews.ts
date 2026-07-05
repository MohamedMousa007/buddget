'use client'

import { useCallback, useEffect, useState } from 'react'
import { isNative } from '@/lib/native/isNative'
import { subscribeNetwork } from '@/hooks/useNetworkStatus'
import { matchCuratedPattern } from '@/lib/sms/patterns'
import { isNonTransaction } from '@/lib/sms/patterns/preFilter'
import type { SmsKind } from '@/lib/sms/patterns/types'

/**
 * In-app preview of SMS captured but not yet delivered to the server (the
 * native pending queue). Curated bank patterns run LOCALLY here — same
 * git-versioned regexes as the server's tier-1 parser — so recognized
 * transactions show real amount/merchant while offline. These are ephemeral
 * UI cards, never store rows: the real transaction is still created by the
 * server pipeline (dedup, transfer pairing, salary matching) once the queue
 * drains, and the cards disappear.
 */

export interface PendingSmsPreview {
  key: string
  receivedAt: string
  /** Curated match — null when only the AI tier can parse it (shown as generic). */
  parsed: {
    bank: string
    kind: SmsKind
    amount: number
    currency: string
    counterparty: string | null
  } | null
}

export function usePendingSmsPreviews(): PendingSmsPreview[] {
  const [previews, setPreviews] = useState<PendingSmsPreview[]>([])

  const refresh = useCallback(async () => {
    if (!isNative()) return
    const { peekPendingSms } = await import('@/lib/native/smsTracker')
    const items = await peekPendingSms()
    const next: PendingSmsPreview[] = []
    for (const [i, item] of items.entries()) {
      // Obvious non-transactions (OTPs, balance checks) never become cards.
      if (isNonTransaction(item.message)) continue
      const m = matchCuratedPattern(item.message, item.sender || null)
      next.push({
        key: `${item.receivedAt}-${i}`,
        receivedAt: item.receivedAt,
        parsed: m
          ? {
              bank: m.bank,
              kind: m.kind,
              amount: m.amount,
              currency: m.currency,
              counterparty: m.counterparty,
            }
          : null,
      })
    }
    setPreviews(next)
  }, [])

  useEffect(() => {
    if (!isNative()) return
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onQueueChanged = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('buddget:sms-queue-changed', onQueueChanged)
    const unsubNet = subscribeNetwork(() => void refresh())
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('buddget:sms-queue-changed', onQueueChanged)
      unsubNet()
    }
  }, [refresh])

  return previews
}
