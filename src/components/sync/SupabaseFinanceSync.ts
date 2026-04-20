'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSyncFailures } from '@/lib/store/useSyncFailures'
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
 * Singleton slices (not array-of-rows) that never fire rapidly — toggling a
 * theme, flipping a currency, marking onboarding done. These flush with no
 * debounce so the DB reflects the change before the user can reload. Bulk
 * list slices (expenses, debts, …) still get the 500 ms coalesce to batch
 * rapid keystrokes during form entry.
 */
const INSTANT_SLICE_KEYS: ReadonlySet<TrackedSliceKey> = new Set<TrackedSliceKey>([
  'profile',
  'settings',
  'onboardingState',
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
 *  - Singleton-slice writes (profile / settings / onboardingState /
 *    activeBudgetPlanId / financialGoalsNotes) flush with no debounce —
 *    theme / currency / onboarding toggles never fire rapidly, so there is
 *    nothing to batch and zero reason to delay. List slices still use a
 *    500 ms coalesce to batch rapid keystrokes during form entry.
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
      try {
        const initial = useFinanceStore.getState()
        const localSnap = snapshot(initial)
        const localHasData = hasMeaningfulLocalState(localSnap)

        // If localStorage already has this user's state (profile.id matches),
        // skip the pullCore overwrite. Otherwise reloading within the flush
        // window reverts recent edits (theme, currency, etc.) to whatever was
        // last on the server. Transactional slices (expenses / debts / …) are
        // still refreshed by the per-slice useHydrate* hooks, which is the
        // intended cross-device path.
        const alreadyHydratedForUser = initial.profile.id === userId
        if (alreadyHydratedForUser && !localHasData) {
          return
        }

        if (localHasData) {
          const server = await pullAll(supabase, userId)
          if (server) {
            // Re-snapshot right before the merge. The user may have edited
            // rows DURING the pullAll round-trip — those edits live in the
            // live store but not in the initial `localSnap` captured above.
            // Merging against the latest local state preserves them.
            const latestLocal = snapshot(useFinanceStore.getState())
            const merged = mergeSnapshots(latestLocal, server)
            // Belt-and-suspenders: even though singleton slices now flush
            // instantly (so the server should already hold the latest value
            // by the time this pull completes), keep the local copy on a
            // reload of an already-hydrated user. Protects against the edge
            // case where the instant flush is still in-flight while this
            // pull resolves, and `mergeSnapshots` would otherwise prefer
            // server — which is correct for guest→auth promotion but wrong
            // here.
            const trustLocalSingletons = alreadyHydratedForUser
            useFinanceStore.setState({
              profile: trustLocalSingletons ? latestLocal.profile : merged.profile,
              settings: trustLocalSingletons ? latestLocal.settings : merged.settings,
              onboardingState: trustLocalSingletons
                ? latestLocal.onboardingState
                : merged.onboardingState,
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
        // Singleton toggle (theme / currency / onboarding / …) — flush now.
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
