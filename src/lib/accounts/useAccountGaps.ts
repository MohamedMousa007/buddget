'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { createClient } from '@/lib/supabase/client'
import { computeBalances } from './balance'
import { detectGap, type BalanceReport, type GapResult } from './gap'
import { useLedgerInput } from './useAccounts'

const SNOOZE_KEY = 'buddget.accountGapSnooze'

function readSnoozed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{}') } catch { return {} }
}

/** "Not sure": hides this gap until a newer bank report arrives. */
export function snoozeGap(accountId: string, reportedAt: string): void {
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...readSnoozed(), [accountId]: reportedAt })) } catch { /* private mode */ }
}

/**
 * Accounts whose SMS balance reports disagree with the ledger across two consecutive reports.
 * Computed here, on the device that owns the ledger; the server only stores the raw reports.
 */
export function useAccountGaps(): { gaps: Record<string, GapResult>; refresh: () => void } {
  const { online } = useNetworkStatus()
  const { user } = useAuth()
  const ledger = useLedgerInput()
  const [reports, setReports] = useState<Record<string, BalanceReport[]>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!online || !user) return
    let off = false
    void createClient().rpc('latest_balance_reports').then(({ data }) => {
      if (off || !data) return
      const grouped: Record<string, BalanceReport[]> = {}
      for (const r of data) (grouped[r.payment_method_id] ??= []).push({ balance: r.balance, reportedAt: r.reported_at })
      setReports(grouped)
    })
    return () => { off = true }
  }, [online, user, tick])

  const gaps = useMemo(() => {
    const out: Record<string, GapResult> = {}
    const snoozed = readSnoozed()
    for (const pm of ledger.paymentMethods) {
      const rs = reports[pm.id]
      if (!rs || rs.length < 2 || pm.trackSms === false) continue
      const probe = computeBalances(ledger).get(pm.id)
      if (!probe) continue
      const tolerance = probe.approx ? Math.max(5, Math.abs(probe.balance) * 0.005) : 1
      const gap = detectGap(rs, (instant) => computeBalances(ledger, instant).get(pm.id)?.balance, tolerance)
      if (gap && snoozed[pm.id] !== gap.reportedAt) out[pm.id] = gap
    }
    return out
  }, [ledger, reports])

  return { gaps, refresh: () => setTick((n) => n + 1) }
}
