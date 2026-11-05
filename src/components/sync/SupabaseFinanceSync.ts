'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSyncFailures } from '@/lib/store/useSyncFailures'
import { baselineAfterFlush, flushRetryDelay } from './flushBaseline'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  pullAll,
  pullDelta,
  applyDelta,
  readSyncCursor,
  writeSyncCursor,
  clearSyncCursors,
  decideReset,
  readResetSeen,
  writeResetSeen,
  flushDiff,
  snapshot,
  emptySnapshot,
  mergeSnapshots,
} from '@/lib/supabase/remote'
import { cacheOwnerMismatch } from '@/lib/auth/cacheOwnerCheck'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { markHydrated } from '@/hooks/remote/hydrateGuard'
import { ensureMarketDataFresh } from '@/lib/market/marketData'
import { isSecondFactorBlocked, onSecondFactorResolved, useSecondFactorGate } from '@/lib/auth/secondFactorGate'
import { applyTheme } from '@/lib/theme/applyTheme'
import { isOnline, networkReady, subscribeNetwork } from '@/hooks/useNetworkStatus'
import type { Snapshot } from '@/lib/supabase/remote'

const DEBOUNCE_MS = 500

/** Imperative flush handle set by the mounted `SupabaseFinanceSync`. Other
 *  modules (e.g. AuthProvider.signOut) call `flushFinanceNow()` to drain any
 *  pending debounced write before they wipe localStorage. Returns a promise
 *  so callers can await the round-trip. */
let pendingFlush: (() => Promise<boolean>) | null = null
export function flushFinanceNow(): Promise<void> {
  return pendingFlush ? pendingFlush().then(() => undefined) : Promise.resolve()
}

/** Imperative full-sync handle (set by the mounted `SupabaseFinanceSync`).
 *  Pull-to-refresh calls `syncFinanceNow()` to push pending local edits, then
 *  pull the server snapshot and merge it into the store — without flipping
 *  `dataReady` (the PTR spinner is the only progress affordance). */
let pendingSync: (() => Promise<void>) | null = null
export function syncFinanceNow(): Promise<void> {
  return pendingSync ? pendingSync() : Promise.resolve()
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
 * Last user a pull() ran for. Re-mounts for the SAME user (auth-event churn,
 * token refresh) must not blank `dataReady` — the app is already showing live
 * data and flipping it would drop every page to skeletons. A genuine account
 * switch still forces the flip (belt-and-suspenders on top of clearBudgetData).
 */
let lastPulledUserId: string | null = null

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
  | 'activeBudgetPlanId' | 'paymentMethods' | 'incomeSources' | 'incomeEvents' | 'expenses'
  | 'recurringExpenses' | 'subscriptions' | 'debts' | 'debtPayments'
  | 'recurringDebtPayments' | 'savingsAccounts' | 'investmentHoldings' | 'receipts'
  | 'savingsTransactions' | 'recurringSavingsDeposits' | 'goals' | 'budgetPlans' | 'budgetPlanActivations' | 'buddgyMemories' | 'accountAdjustments'

const TRACKED_SLICES: readonly TrackedSliceKey[] = [
  'profile', 'settings', 'financialGoalsNotes',
  'activeBudgetPlanId', 'paymentMethods', 'incomeSources', 'incomeEvents', 'expenses',
  'recurringExpenses', 'subscriptions', 'debts', 'debtPayments',
  'recurringDebtPayments', 'savingsAccounts', 'investmentHoldings', 'receipts',
  'savingsTransactions', 'recurringSavingsDeposits', 'goals', 'budgetPlans', 'budgetPlanActivations', 'buddgyMemories', 'accountAdjustments',
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
  // In-flight guard for the shared reconcile (mount warm-start, reconnect, PTR).
  // With cache-first the UI is interactive during the background pull, so this
  // replaces the old `dataReady=false` gate as the "don't double-diff" lock.
  const reconciling = useRef(false)
  const runAgain = useRef(false)

  useEffect(() => {
    hydrated.current = false
    prevSnap.current = null
    lastScheduleSnap.current = null
    // Fresh session: clear any suspend flag left behind by a previous
    // sign-out so this user's edits start flowing to the server again.
    syncSuspended = false
    // Last line of defence: a cache owned by another account is wiped, never merged or pushed under this user.
    if (ownedByAnother(userId)) {
      syncSuspended = true
      clearBudgetData()
      syncSuspended = false
    }
    if (!supabaseRef.current) supabaseRef.current = createClient()
    const supabase = supabaseRef.current

    let cancelled = false
    async function pull() {
      // On native the OS status lands after mount; deciding earlier reads a stale "online" and fails in airplane mode.
      await networkReady
      if (cancelled) return
      // Warm cache-first path: this user's data is already persisted in
      // localStorage, so render it instantly and reconcile in the background.
      // The reconcile goes through `syncFinanceNow()` (flush → pull → re-baseline)
      // — flush-first is mandatory: it commits any pending delete/settings edit
      // BEFORE pullAll reads, so the tombstone-less server snapshot can't
      // resurrect a locally-deleted row and the server settings can't revert a
      // local toggle. Requires the network; the offline case falls through to
      // the offline fast-path below.
      if (isOnline() && useFinanceStore.getState().profile.id === userId) {
        prevSnap.current = snapshot(useFinanceStore.getState())
        lastScheduleSnap.current = sliceRefs(useFinanceStore.getState())
        hydrated.current = true
        lastPulledUserId = userId
        // Mark the slices hydrated for pages that wait on them.
        for (const slice of ['expenses','income','incomeEvents','debts','goals','savings','subscriptions','budget']) {
          markHydrated(userId, slice)
        }
        useFinanceStore.getState().setDataReady(true)
        void ensureMarketDataFresh().catch(() => { /* cached rates remain */ })
        // Defer one tick so the sibling effect has assigned `pendingSync`.
        setTimeout(() => {
          void syncFinanceNow().catch((e) => console.error('[finance sync] warm reconcile failed', e))
        }, 0)
        return
      }
      if (lastPulledUserId !== userId) useFinanceStore.getState().setDataReady(false)
      lastPulledUserId = userId
      // Offline fast-path: the persisted store IS the data — don't make the
      // user wait on a pull that cannot succeed (it would drag the splash to
      // its 8 s ceiling). Baseline the flush snapshots from the cache so
      // offline edits diff correctly, and let the reconnect trigger run the
      // real sync in the background once the network returns.
      if (!isOnline()) {
        prevSnap.current = snapshot(useFinanceStore.getState())
        lastScheduleSnap.current = sliceRefs(useFinanceStore.getState())
        hydrated.current = true
        useFinanceStore.getState().setDataReady(true)
        return
      }
      // ponytail: start market fetch immediately so it overlaps with pullAll instead of running after
      const marketPromise = Promise.race([
        ensureMarketDataFresh(),
        new Promise<void>((r) => setTimeout(r, 3500)),
      ])
      let pulled = false
      try {
        // Pull before flipping dataReady, even on a warm start: lifting the splash on cached numbers and then
        // merging server rows visibly changes the dashboard totals. The pull is one small delta request.
        await runFullSync(supabase, userId)
        pulled = true
      } catch (e) {
        console.error('[finance sync] pull failed', e)
      } finally {
        // Await the market fetch started above — by now it's been running in
        // parallel with pullAll so it's likely already done or nearly done.
        try { await marketPromise } catch { /* keep cached/default rates */ }
        // A failed pull leaves no trustworthy baseline: keep it empty so the first flush sends local state.
        prevSnap.current = baselineAfterFlush(null, snapshot(useFinanceStore.getState()), pulled)
        lastScheduleSnap.current = sliceRefs(useFinanceStore.getState())
        hydrated.current = true
        useFinanceStore.getState().setDataReady(true)
      }
    }

    void pull()

    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId])

  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    const supabase = supabaseRef.current

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retryAttempt = 0
    const scheduleRetry = () => {
      if (retryTimer) return
      const delay = flushRetryDelay(retryAttempt)
      if (delay === null || !isOnline()) return
      retryAttempt++
      retryTimer = setTimeout(() => {
        retryTimer = null
        void flush()
      }, delay)
    }

    let gateTimer: ReturnType<typeof setTimeout> | null = null
    const retryAfterSuppress = () => {
      const { open, suppressUntil } = useSecondFactorGate.getState()
      if (gateTimer || open) return
      gateTimer = setTimeout(() => {
        gateTimer = null
        void flush()
      }, Math.max(0, suppressUntil - Date.now()) + 50)
    }

    const flush = async (): Promise<boolean> => {
      if (!hydrated.current) return true
      // Offline: don't attempt a doomed flush that would raise the sync-failure
      // banner. prevSnap doesn't advance, so the reconnect flush (or the next
      // online mutation) sends exactly this diff.
      if (!isOnline()) return true
      // A stale debounce timer can fire after suspendFinanceSync() is called
      // during sign-out. At that point the store has already been reset to
      // empty defaults, and flushing would soft-delete all server-side data.
      if (syncSuspended) return true
      if (useFinanceStore.getState().profile.id === 'local') return true
      // Never push rows to the server under a different user than the cache owner.
      if (ownedByAnother(userId)) return true
      // The server wants the second factor: sending now would only be refused. Nothing is dropped
      // (prevSnap does not advance); the challenge resumes the sync when passed.
      if (isSecondFactorBlocked()) {
        retryAfterSuppress()
        return false
      }
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
        const adopted = new Set(result.adoptedPaydays ?? [])
        if (adopted.size > 0) {
          // Another device's row won the payday: drop our duplicate; the next pull brings the live one.
          useFinanceStore.setState((s) => ({ incomeEvents: s.incomeEvents.filter((e) => !adopted.has(e.id)) }))
        }
        if (!result.anyError) {
          prevSnap.current = adopted.size > 0 ? { ...next, incomeEvents: next.incomeEvents.filter((e) => !adopted.has(e.id)) } : next
          retryAttempt = 0
        } else {
          console.error('[finance sync] per-table flush errors:', result.errors)
          scheduleRetry()
        }
        return !result.anyError
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        useSyncFailures
          .getState()
          .recordFailures([`sync.flush: ${message.slice(0, 200)}`])
        console.error('[finance sync] flush threw', e)
        scheduleRetry()
        return false
      }
    }

    // Expose for imperative callers (signOut).
    pendingFlush = flush
    const stopResume = onSecondFactorResolved(() => {
      retryAttempt = 0
      void pendingSync?.().catch((e) => console.error('[finance sync] resume after second factor failed', e))
    })

    // Expose full-sync for pull-to-refresh and the reconnect trigger. Flush
    // FIRST, then pull: running them concurrently let pullAll read the server
    // before the flush's soft-deletes/updates committed, and the tombstone-less
    // union merge then resurrected offline deletes and reverted offline
    // singleton edits (the re-baseline made it permanent). Two serial hops is
    // the price of correctness after offline edits.
    // Re-baseline the flush snapshots afterwards so merged server rows aren't
    // seen as fresh local writes.
    pendingSync = async () => {
      // Single in-flight reconcile — mount warm-start, reconnect, PTR and nudges all funnel here; overlapping runs
      // would diff against a shifting baseline. A request that arrives mid-run (a nudge for a message saved after
      // this pull started) is not dropped: it makes the run go once more.
      if (reconciling.current) {
        runAgain.current = true
        return
      }
      reconciling.current = true
      try {
        for (let pass = 0; pass < 3; pass++) {
          runAgain.current = false
          const flushed = await flush()
          await runFullSync(supabase, userId)
          prevSnap.current = baselineAfterFlush(prevSnap.current, snapshot(useFinanceStore.getState()), flushed)
          lastScheduleSnap.current = sliceRefs(useFinanceStore.getState())
          if (!runAgain.current) break
        }
      } finally {
        reconciling.current = false
      }
    }

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
    // Resume: reconcile with the server so stale cached data (or a
    // transaction that landed while backgrounded) shows up immediately
    // instead of waiting for a manual pull-to-refresh. `pendingSync`'s own
    // `reconciling` lock keeps this from overlapping the mount warm-start.
    let lastResumeSync = 0
    const onShow = () => {
      if (syncSuspended || !hydrated.current) return
      const now = Date.now()
      if (now - lastResumeSync < 30_000) return
      lastResumeSync = now
      void pendingSync?.().catch((e) => console.error('[finance sync] resume reconcile failed', e))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
      else onShow()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)

    // Native resume: `visibilitychange` isn't reliable across every backgrounding
    // path on Capacitor (see AppShell's SMS resume listener), so also hook the
    // native app-state event directly.
    let cancelledListeners = false
    let removeAppStateListener: (() => void) | null = null
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onShow()
        })
        if (cancelledListeners) void handle.remove()
        else removeAppStateListener = () => { void handle.remove() }
      } catch { /* web build without @capacitor/app — ignore */ }
    })()

    // Reconnect trigger: when the device comes back online, push queued local
    // edits + pull server truth (same parallel path as pull-to-refresh), then
    // replay any SMS the native bridge queued while offline. Debounced 2 s so
    // a flapping connection doesn't stampede the server. Never touches
    // dataReady — rows merge in place with no loading state.
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const unsubNet = subscribeNetwork((online) => {
      if (!online) {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
        return
      }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void (async () => {
          if (syncSuspended || !hydrated.current) return
          void ensureMarketDataFresh().catch(() => { /* cached rates remain */ })
          try {
            await pendingSync?.()
          } catch (e) {
            console.error('[finance sync] reconnect sync failed', e)
          }
          try {
            const { data } = await supabase.auth.getSession()
            const token = data.session?.access_token
            const uid = data.session?.user?.id
            if (token && uid) {
              const { drainAndSubmitPendingSms } = await import('@/lib/native/smsTracker')
              await drainAndSubmitPendingSms(token, uid)
            }
          } catch { /* next app open drains */ }
        })()
      }, 2000)
    })

    return () => {
      stopResume()
      unsub()
      unsubNet()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelledListeners = true
      removeAppStateListener?.()
      if (timer.current) clearTimeout(timer.current)
      if (retryTimer) clearTimeout(retryTimer)
      if (gateTimer) clearTimeout(gateTimer)
      if (pendingFlush === flush) pendingFlush = null
      pendingSync = null
    }
  }, [userId])

  return null
}

function ownedByAnother(userId: string): boolean {
  return (
    cacheOwnerMismatch(useFinanceStore.getState().profile.id, userId) ||
    cacheOwnerMismatch(useSettingsStore.getState().serverSyncedFor, userId)
  )
}

/**
 * Bring the store up to date with the server and merge. Shared by the mount hydrate and the imperative
 * `syncFinanceNow()` (pull-to-refresh, resume, nudges). One request: the rows that changed since this device last
 * caught up (everything, on a first pull). If the delta call fails for any reason the proven full pull takes over,
 * so sync never depends on the new path. Does NOT touch `dataReady` — callers own the loading affordance.
 */
async function runFullSync(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  // A cursor only means something next to a store that holds this account's data.
  const hasLocalCopy = useFinanceStore.getState().profile.id === userId
  const since = hasLocalCopy ? readSyncCursor(userId, storeVersion()) : null
  try {
    const delta = await pullDelta(supabase, since)
    if (!delta) return
    if (delta.profile) {
      const at = delta.profile.extras.dataResetAt ?? null
      const verdict = decideReset(readResetSeen(userId), at)
      if (verdict !== 'none') writeResetSeen(userId, at)
      if (verdict === 'wipe') {
        // The account was reset elsewhere: our copy is stale, and merging it would bring the erased data back.
        useFinanceStore.getState().reset()
        useSettingsStore.getState().reset()
        clearSyncCursors()
        return runFullSync(supabase, userId)
      }
    }
    // Re-snapshot right before the merge so edits made during the round-trip aren't clobbered.
    const merged = applyDelta(snapshot(useFinanceStore.getState()), delta)
    applyMerged(merged, userId)
    writeSyncCursor(userId, storeVersion(), delta.cursor)
    useSettingsStore.getState().markServerSynced(userId)
  } catch (e) {
    console.warn('[finance sync] delta pull failed, using the full pull', e)
    clearSyncCursors()
    await runLegacyFullSync(supabase, userId)
  }
}

/** The persisted store's schema version: a migration that rewrites local data must also restart the cursor. */
function storeVersion(): number {
  return useFinanceStore.persist.getOptions().version ?? 0
}

async function runLegacyFullSync(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  // The fallback path must honour a reset too, or it would merge the stale local copy back in.
  const { data: stamp } = await supabase.from('profiles').select('data_reset_at').eq('id', userId).maybeSingle()
  const at = stamp?.data_reset_at ?? null
  const verdict = decideReset(readResetSeen(userId), at)
  if (verdict !== 'none') writeResetSeen(userId, at)
  if (verdict === 'wipe') {
    useFinanceStore.getState().reset()
    useSettingsStore.getState().reset()
    clearSyncCursors()
  }
  const server = await pullAll(supabase, userId)
  if (!server) return
  applyMerged(mergeSnapshots(snapshot(useFinanceStore.getState()), server), userId)
  useSettingsStore.getState().markServerSynced(userId)
}

function applyMerged(merged: Snapshot, userId: string): void {
  useFinanceStore.setState({
    profile: merged.profile,
    settings: merged.settings,
    financialGoalsNotes: merged.financialGoalsNotes,
    activeBudgetPlanId: merged.activeBudgetPlanId,
    paymentMethods: merged.paymentMethods,
    incomeSources: merged.incomeSources,
    incomeEvents: merged.incomeEvents,
    expenses: merged.expenses,
    receipts: merged.receipts,
    recurringExpenses: merged.recurringExpenses,
    subscriptions: merged.subscriptions,
    debts: merged.debts,
    debtPayments: merged.debtPayments,
    recurringDebtPayments: merged.recurringDebtPayments,
    savingsAccounts: merged.savingsAccounts,
    investmentHoldings: merged.investmentHoldings,
    savingsTransactions: merged.savingsTransactions,
    recurringSavingsDeposits: merged.recurringSavingsDeposits,
    goals: merged.goals,
    budgetPlans: merged.budgetPlans,
    budgetPlanActivations: merged.budgetPlanActivations,
    buddgyMemories: merged.buddgyMemories,
    accountAdjustments: merged.accountAdjustments,
  })
  // Apply the server theme synchronously so the <html> class is already
  // correct before the loading splash is removed.
  applyTheme(merged.settings.theme)
  // Mark all slices as hydrated so per-page hooks skip redundant fetches.
  for (const slice of ['expenses','income','incomeEvents','debts','goals','savings','subscriptions','budget']) {
    markHydrated(userId, slice)
  }
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
