'use client'

import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { normalizeRuns } from '@/lib/goals/goalDetail'
import type { AllocationRun } from '@/lib/goals/goalStatus'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'

/**
 * Completed funding cycles per goal (behind / streak history), in each goal's currency and including
 * money added by hand. Empty offline or before the first run.
 */
export function useGoalAllocationRuns(): Record<string, AllocationRun[]> {
  const { user } = useAuth()
  const [raw, setRaw] = useState<Record<string, AllocationRun[]>>({})
  const { goals, txs, rates, base } = useFinanceStore(
    useShallow((s) => ({ goals: s.goals, txs: s.savingsTransactions, rates: s.exchangeRates, base: s.settings.baseCurrency })),
  )
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    createClient()
      .from('goal_allocation_runs')
      .select('goal_id, period, planned, amount')
      .eq('user_id', uid)
      .then(({ data }) => {
        if (cancelled || !data) return
        const by: Record<string, AllocationRun[]> = {}
        for (const r of data) {
          ;(by[r.goal_id] ??= []).push({ period: r.period, planned: Number(r.planned), amount: Number(r.amount) })
        }
        setRaw(by)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return useMemo(() => {
    const out: Record<string, AllocationRun[]> = {}
    for (const g of goals) {
      const runs = raw[g.id]
      if (!runs) continue
      out[g.id] = normalizeRuns({
        goal: g,
        runs,
        txs,
        baseToGoal: (n) => convertCurrency(n, base, g.currency, rates),
        toGoal: (a, c) => convertCurrency(a, c, g.currency, rates),
      })
    }
    return out
  }, [raw, goals, txs, rates, base])
}
