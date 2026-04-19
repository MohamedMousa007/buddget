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

const DEBOUNCE_MS = 500

/** Imperative flush handle set by the mounted `SupabaseFinanceSync`. Other
 *  modules (e.g. AuthProvider.signOut) call `flushFinanceNow()` to drain any
 *  pending debounced write before they wipe localStorage. Returns a promise
 *  so callers can await the round-trip. */
let pendingFlush: (() => Promise<void>) | null = null
export function flushFinanceNow(): Promise<void> {
  return pendingFlush ? pendingFlush() : Promise.resolve()
}

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
 * Every data-bearing snapshot slice the flush cares about. Subscribing
 * without a selector fires on every `set()` — even FX-rate ticks — which
 * resets the debounce timer and can starve real user writes for minutes
 * at a time. We shallow-compare these slice references (Zustand updates
 * always produce new references for the mutated slice) to decide whether
 * a re-schedule is warranted.
 */
type TrackedSliceKey =
  | 'profile' | 'settings' | 'onboardingState' | 'financialGoalsNotes'
  | 'activeBudgetPlanId' | 'paymentMethods' | 'incomeSources' | 'expenses'
  | 'recurringExpenses' | 'subscriptions' | 'debts' | 'debtPayments'
  | 'recurringDebtPayments' | 'savingsAccounts' | 'savingsHoldings'
  | 'savingsTransactions' | 'recurringSavingsDeposits' | 'goals' | 'budgetPlans'

const TRACKED_SLICES: readonly TrackedSliceKey[] = [
  'profile', 'settings', 'onboardingState', 'financialGoalsNotes',
  'activeBudgetPlanId', 'paymentMethods', 'incomeSources', 'expenses',
  'recurringExpenses', 'subscriptions', 'debts', 'debtPayments',
  'recurringDebtPayments', 'savingsAccounts', 'savingsHoldings',
  'savingsTransactions', 'recurringSavingsDeposits', 'goals', 'budgetPlans',
]

/**
 * Supabase persistence layer.
 *
 * Hydrate: prefer normalised tables (pullAll); fall back to the legacy
 * user_finance.payload blob when the user has no profiles row yet.
 *
 * Flush: per-table diffs via `flushDiff` (sends only what changed) PLUS a
 * dual-write to user_finance.payload during the stability window.
 *
 * Data-loss hardening:
 *  - Debounce cut from 1.6 s → 500 ms.
 *  - `visibilitychange` (→ hidden) + `pagehide` listeners force-flush any
 *    pending write so closing / reloading / backgrounding the tab never
 *    drops a write.
 *  - The subscribe-driven reschedule only fires when a tracked-data slice
 *    actually changed — FX / gold ticks no longer reset the timer.
 *  - `flushFinanceNow()` lets signOut await the round-trip before
 *    `clearBudgetData` wipes localStorage.
 */
export function SupabaseFinanceSync({ userId }: { userId: string }) {
  const hydrated = useRef(false)
  const prevSnap = useRef<Snapshot | null>(null)
  const lastScheduleSnap = useRef<ReturnType<typeof sliceRefs> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    hydrated.current = false
    prevSnap.current = null
    lastScheduleSnap.current = null
    if (!supabaseRef.current) supabaseRef.current = createClient()
    const supabase = supabaseRef.current

    async function pull() {
      try {
        const localSnap = snapshot(useFinanceStore.getState())
        const localHasData = hasMeaningfulLocalState(localSnap)

        if (localHasData) {
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
            return
          }
          return
        }

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
        prevSnap.current = snapshot(useFinanceStore.getState())
        lastScheduleSnap.current = sliceRefs(useFinanceStore.getState())
        hydrated.current = true
      }
    }

    void pull()

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId])

  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    const supabase = supabaseRef.current

    const flush = async () => {
      if (!hydrated.current) return
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }

      const next = snapshot(useFinanceStore.getState())
      const prev = prevSnap.current ?? emptySnapshot()

      try {
        const result = await flushDiff(supabase, userId, prev, next)
        if (!result.anyError) {
          prevSnap.current = next
        } else {
          console.error('[finance sync] per-table flush errors:', result.errors)
        }
        const { error } = await supabase
          .from('user_finance')
          .upsert(
            {
              user_id: userId,
              payload: buildFinancePayload(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
        if (error) console.error('[finance sync] legacy blob upsert failed', error.message)
      } catch (e) {
        console.error('[finance sync] flush threw', e)
      }
    }

    // Expose for imperative callers (signOut).
    pendingFlush = flush

    const unsub = useFinanceStore.subscribe(() => {
      if (!hydrated.current) return
      const next = sliceRefs(useFinanceStore.getState())
      const prev = lastScheduleSnap.current
      if (prev && sliceRefsEqual(prev, next)) {
        // Store changed but not in a tracked slice (e.g. FX-rate tick). Do
        // not touch the debounce timer — that would starve user writes.
        return
      }
      lastScheduleSnap.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void flush()
      }, DEBOUNCE_MS)
    })

    // Force-flush when the tab is about to be hidden / unloaded. Covers
    // desktop reload, mobile background, iOS app-switch. `visibilitychange`
    // fires BEFORE unload so fetches have a chance to complete.
    const onHide = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
        void flush()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer.current) clearTimeout(timer.current)
      if (pendingFlush === flush) pendingFlush = null
    }
  }, [userId])

  return null
}

// ─── Slice-change detection ──────────────────────────────────────────────

/** Grab the object reference for every tracked slice. Zustand mutates by
 *  producing a new reference, so `===` on these is sufficient to know if
 *  the data changed. */
function sliceRefs(state: ReturnType<typeof useFinanceStore.getState>) {
  const out: Record<string, unknown> = {}
  for (const key of TRACKED_SLICES) out[key] = state[key]
  return out as Record<TrackedSliceKey, unknown>
}

function sliceRefsEqual(
  a: Record<TrackedSliceKey, unknown>,
  b: Record<TrackedSliceKey, unknown>,
): boolean {
  for (const key of TRACKED_SLICES) {
    if (a[key] !== b[key]) return false
  }
  return true
}
