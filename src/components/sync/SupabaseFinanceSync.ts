'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSyncFailures } from '@/lib/store/useSyncFailures'
import {
  pullAll,
  flushDiff,
  snapshot,
  emptySnapshot,
  mergeSnapshots,
} from '@/lib/supabase/remote'
import { markHydrated } from '@/hooks/remote/hydrateGuard'
import { ensureMarketDataFresh } from '@/lib/market/marketData'
import { applyTheme } from '@/lib/theme/applyTheme'
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

/**
 * Global "stop talking to the server" switch. The subscribe listener bails
 * out when this is true, which matters during sign-out: `clearBudgetData()`
 * calls `useFinanceStore.reset()`, and without this flag the reset would
 * fire the subscribe listener and push the DEFAULT settings back to the
 * server — overwriting whatever the user just saved. Call
 * `suspendFinanceSync()` immediately before any reset-and-clear path, and
 * it auto-unsuspends on the next `SupabaseFinanceSync` mount (i.e. the
 * user's next sign-in).
 */
let syncSuspended = false
export function suspendFinanceSync(): void {
  syncSuspended = true
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
  | 'profile' | 'settings' | 'financialGoalsNotes'
  | 'activeBudgetPlanId' | 'paymentMethods' | 'incomeSources' | 'expenses'
  | 'recurringExpenses' | 'subscriptions' | 'debts' | 'debtPayments'
  | 'recurringDebtPayments' | 'savingsAccounts' | 'savingsHoldings'
  | 'savingsTransactions' | 'recurringSavingsDeposits' | 'goals' | 'budgetPlans'

const TRACKED_SLICES: readonly TrackedSliceKey[] = [
  'profile', 'settings', 'financialGoalsNotes',
  'activeBudgetPlanId', 'paymentMethods', 'incomeSources', 'expenses',
  'recurringExpenses', 'subscriptions', 'debts', 'debtPayments',
  'recurringDebtPayments', 'savingsAccounts', 'savingsHoldings',
  'savingsTransactions', 'recurringSavingsDeposits', 'goals', 'budgetPlans',
]

/**
 * Singleton slices (not array-of-rows) that never fire rapidly — toggling a
 * theme, flipping a currency. These flush with no debounce so the DB
 * reflects the change before the user can reload. Bulk list slices
 * (expenses, debts, …) still get the 500 ms coalesce to batch rapid
 * keystrokes during form entry.
 */
const INSTANT_SLICE_KEYS: ReadonlySet<TrackedSliceKey> = new Set<TrackedSliceKey>([
  'profile',
  'settings',
  'activeBudgetPlanId',
  'financialGoalsNotes',
])

/**
 * Supabase persistence layer.
 *
 * Hydrate: prefer normalised tables (pullAll); fall back to the legacy
 * user_finance.payload JSONB blob read-only when the user has no profiles
 * row yet (covers a small set of migration-era accounts).
 *
 * Flush: per-table diffs via `flushDiff` — sends only what changed. The
 * legacy dual-write to `user_finance.payload` was retired once normalised
 * tables stabilised; saves ~50% of the write volume per flush.
 *
 * Data-loss hardening:
 *  - Singleton-slice writes (profile / settings / activeBudgetPlanId /
 *    financialGoalsNotes) flush with no debounce — theme / currency
 *    toggles never fire rapidly, so there is nothing to batch and zero
 *    reason to delay. List slices still use a 500 ms coalesce to batch
 *    rapid keystrokes during form entry.
 *  - `visibilitychange` (→ hidden) + `pagehide` listeners force-flush any
 *    pending write so closing / reloading / backgrounding the tab never
 *    drops a write.
 *  - Subscribe-driven reschedule only fires when a tracked-data slice
 *    reference actually changed — FX / gold ticks no longer reset the
 *    timer.
 *  - `flushFinanceNow()` lets signOut await the round-trip before
 *    `clearBudgetData` wipes localStorage.
 *  - Guest-merge path re-snapshots from the LIVE store right before
 *    applying the merge so edits made during `pullAll` aren't clobbered.
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
    // Fresh session: clear any suspend flag left behind by a previous
    // sign-out so this user's edits start flowing to the server again.
    syncSuspended = false
    if (!supabaseRef.current) supabaseRef.current = createClient()
    const supabase = supabaseRef.current

    async function pull() {
      useFinanceStore.getState().setDataReady(false)
      // ponytail: start market fetch immediately so it overlaps with pullAll instead of running after
      const marketPromise = Promise.race([
        ensureMarketDataFresh(),
        new Promise<void>((r) => setTimeout(r, 3500)),
      ])
      try {
        // Always pull the full snapshot before flipping dataReady — even on a
        // warm start where this user's data is already in localStorage. Skipping
        // the pull (the old `profile.id === userId && hasLocalData` early-return)
        // lifted the splash on CACHED numbers, then the per-page `useHydrate*`
        // hooks refetched and merged server rows after mount, visibly changing
        // the dashboard totals. Pulling here marks every slice hydrated so those
        // hooks short-circuit → the splash covers the whole sync, no flicker.
        const server = await pullAll(supabase, userId)
        if (server) {
          // Re-snapshot right before the merge so edits made during the
          // pullAll round-trip aren't clobbered.
          const latestLocal = snapshot(useFinanceStore.getState())
          const merged = mergeSnapshots(latestLocal, server)
          // Server always wins for singletons — settings flush instantly so
          // the DB is always up to date by the time this pull completes.
          useFinanceStore.setState({
            profile: merged.profile,
            settings: merged.settings,
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
          // Apply the server theme synchronously so the <html> class is already
          // correct before `dataReady` flips and the loading splash is removed —
          // no relying on the useThemeSync effect firing after the splash lifts.
          applyTheme(merged.settings.theme)
          // Mark all slices as hydrated so per-page hooks skip redundant fetches.
          for (const slice of ['expenses','income','debts','goals','savings','subscriptions','budget']) {
            markHydrated(userId, slice)
          }
        }
      } catch (e) {
        console.error('[finance sync] pull failed', e)
      } finally {
        // Await the market fetch started above — by now it's been running in
        // parallel with pullAll so it's likely already done or nearly done.
        try { await marketPromise } catch { /* keep cached/default rates */ }
        prevSnap.current = snapshot(useFinanceStore.getState())
        lastScheduleSnap.current = sliceRefs(useFinanceStore.getState())
        hydrated.current = true
        useFinanceStore.getState().setDataReady(true)
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
      // A stale debounce timer can fire after suspendFinanceSync() is called
      // during sign-out. At that point the store has already been reset to
      // empty defaults, and flushing would soft-delete all server-side data.
      if (syncSuspended) return
      if (useFinanceStore.getState().profile.id === 'local') return
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }

      const next = snapshot(useFinanceStore.getState())
      const prev = prevSnap.current ?? emptySnapshot()

      try {
        const result = await flushDiff(supabase, userId, prev, next)
        // Always feed the result (empty on success, non-empty on
        // error) into the failures store — a successful flush
        // clears any previously-displayed banner.
        useSyncFailures.getState().recordFailures(result.anyError ? result.errors : [])
        if (!result.anyError) {
          prevSnap.current = next
        } else {
          console.error('[finance sync] per-table flush errors:', result.errors)
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        useSyncFailures
          .getState()
          .recordFailures([`sync.flush: ${message.slice(0, 200)}`])
        console.error('[finance sync] flush threw', e)
      }
    }

    // Expose for imperative callers (signOut).
    pendingFlush = flush

    const unsub = useFinanceStore.subscribe(() => {
      if (!hydrated.current) return
      // Sign-out in progress: the store is being reset to defaults. Ignore
      // every ping until the next mount — otherwise we'd overwrite the
      // user's saved settings / profile on the server with defaults.
      if (syncSuspended) return
      const next = sliceRefs(useFinanceStore.getState())
      const prev = lastScheduleSnap.current
      if (prev && sliceRefsEqual(prev, next)) {
        // Store changed but not in a tracked slice (e.g. FX-rate tick). Do
        // not touch the debounce timer — that would starve user writes.
        return
      }
      const instantDirty = !prev || anyInstantSliceChanged(prev, next)
      lastScheduleSnap.current = next
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      if (instantDirty) {
        // Singleton toggle (theme / currency / …) — flush now.
        // The in-flight promise settles before any visible reload, so the DB
        // is always at least as fresh as the UI for these fields.
        void flush()
        return
      }
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

function anyInstantSliceChanged(
  prev: Record<TrackedSliceKey, unknown>,
  next: Record<TrackedSliceKey, unknown>,
): boolean {
  for (const key of INSTANT_SLICE_KEYS) {
    if (prev[key] !== next[key]) return true
  }
  return false
}
