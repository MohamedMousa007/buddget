'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  pullCore,
  pullAll,
  flushDiff,
  snapshot,
  emptySnapshot,
  mergeSnapshots,
  hasMeaningfulLocalState,
} from '@/lib/supabase/remote'
import type { Snapshot } from '@/lib/supabase/remote'

const DEBOUNCE_MS = 1600

/** Legacy blob payload — kept during the dual-write safety window. */
function buildFinancePayload() {
  const state = useFinanceStore.getState()
  return {
    profile: state.profile,
    settings: state.settings,
    financialGoalsNotes: state.financialGoalsNotes,
    onboardingState: state.onboardingState,
    incomeSources: state.incomeSources,
    expenses: state.expenses,
    recurringExpenses: state.recurringExpenses,
    budgetCategories: state.budgetCategories,
    budgetPlans: state.budgetPlans,
    activeBudgetPlanId: state.activeBudgetPlanId,
    savingsHoldings: state.savingsHoldings,
    savingsAccounts: state.savingsAccounts,
    savingsTransactions: state.savingsTransactions,
    recurringSavingsDeposits: state.recurringSavingsDeposits,
    paymentMethods: state.paymentMethods,
    debts: state.debts,
    debtPayments: state.debtPayments,
    recurringDebtPayments: state.recurringDebtPayments,
    goals: state.goals,
    subscriptions: state.subscriptions,
  }
}

/**
 * Supabase persistence layer.
 *
 * Hydrate: prefer normalised tables (pullAll); fall back to the legacy user_finance.payload
 * blob when the user has no profiles row yet (pre-DB-migration users in a race window).
 *
 * Flush: per-table diffs via `flushDiff` (sends only what changed) PLUS a dual-write to
 * user_finance.payload during the stability window so we can roll back the frontend
 * without losing data. Dual-write is removed in Phase 5.
 */
export function SupabaseFinanceSync({ userId }: { userId: string }) {
  const hydrated = useRef(false)
  const prevSnap = useRef<Snapshot | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    hydrated.current = false
    prevSnap.current = null
    const supabase = createClient()

    async function pull() {
      try {
        // Snapshot whatever the Zustand `persist` middleware already hydrated from
        // localStorage — for a guest session this is the user's local edits we need
        // to preserve when they sign in.
        const localSnap = snapshot(useFinanceStore.getState())
        const localHasData = hasMeaningfulLocalState(localSnap)

        if (localHasData) {
          // Guest was actively using the app; fetch the full server state and merge
          // so neither side loses data. One-shot cost on sign-in only.
          const server = await pullAll(supabase, userId)
          if (server) {
            const merged = mergeSnapshots(localSnap, server)
            useFinanceStore.setState({
              profile: merged.profile,
              settings: merged.settings,
              onboardingState: merged.onboardingState,
              financialGoalsNotes: merged.financialGoalsNotes,
              activeBudgetPlanId: merged.activeBudgetPlanId,
              paymentMethods: merged.paymentMethods,
              incomeSources: merged.incomeSources,
              expenses: merged.expenses,
              recurringExpenses: merged.recurringExpenses,
              subscriptions: merged.subscriptions,
              debts: merged.debts,
              debtPayments: merged.debtPayments,
              recurringDebtPayments: merged.recurringDebtPayments,
              savingsAccounts: merged.savingsAccounts,
              savingsHoldings: merged.savingsHoldings,
              savingsTransactions: merged.savingsTransactions,
              recurringSavingsDeposits: merged.recurringSavingsDeposits,
              goals: merged.goals,
              budgetPlans: merged.budgetPlans,
            })
            return // prevSnap set in finally{}
          }
          // No server profile yet (new auth account): keep the guest data as-is;
          // the debounced flush will push it up.
          return
        }

        // Standard logged-in flow: pull core only. Per-page hooks fetch the rest.
        const core = await pullCore(supabase, userId)
        if (core) {
          useFinanceStore.setState({
            profile: core.profile,
            settings: core.settings,
            onboardingState: core.onboardingState,
            financialGoalsNotes: core.financialGoalsNotes,
            activeBudgetPlanId: core.activeBudgetPlanId,
            paymentMethods: core.paymentMethods,
          })
        } else {
          // Fall back to legacy blob (pre-migration users).
          const { data, error } = await supabase
            .from('user_finance')
            .select('payload, updated_at')
            .eq('user_id', userId)
            .maybeSingle()
          if (error) {
            console.error('[finance sync] legacy pull failed', error.message)
          } else if (data?.payload && typeof data.payload === 'object') {
            useFinanceStore.getState().importData(JSON.stringify(data.payload))
          }
        }
      } catch (e) {
        console.error('[finance sync] pull failed', e)
      } finally {
        // Capture the now-hydrated state as the diff baseline so the first flush only
        // emits genuine user mutations, not a no-op re-sync.
        prevSnap.current = snapshot(useFinanceStore.getState())
        hydrated.current = true
      }
    }

    void pull()

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId])

  useEffect(() => {
    const supabase = createClient()

    const flush = async () => {
      if (!hydrated.current) return
      timer.current = null

      const next = snapshot(useFinanceStore.getState())
      const prev = prevSnap.current ?? emptySnapshot()

      try {
        const result = await flushDiff(supabase, userId, prev, next)
        if (!result.anyError) {
          prevSnap.current = next
        } else {
          console.error('[finance sync] per-table flush errors:', result.errors)
        }
        // Dual-write the legacy blob as a safety net. Remove in Phase 5.
        const { error } = await supabase
          .from('user_finance')
          .upsert(
            { user_id: userId, payload: buildFinancePayload(), updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
        if (error) console.error('[finance sync] legacy blob upsert failed', error.message)
      } catch (e) {
        console.error('[finance sync] flush threw', e)
      }
    }

    const unsub = useFinanceStore.subscribe(() => {
      if (!hydrated.current) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void flush()
      }, DEBOUNCE_MS)
    })

    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId])

  return null
}
