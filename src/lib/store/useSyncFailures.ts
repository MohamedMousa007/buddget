'use client'

import { create } from 'zustand'

/**
 * In-memory surface for Supabase sync failures.
 *
 * Until this module existed, `flushDiff` errors were swallowed in
 * `console.error` and users had no way to tell that a row they thought
 * they saved never reached the server (FK constraint, RLS denial,
 * network blip). That's how the "my income disappeared after
 * onboarding" bug hid for a week — the local Zustand row survived but
 * the push failed silently.
 *
 * Auto-retry still works: the sync layer doesn't advance its
 * `prevSnap.current` on failure, so the next debounced flush re-runs
 * the same diff. This store just surfaces the failure to the user in
 * the meantime via a small toast-driven banner.
 *
 * Not persisted — failures only matter for the current session. If
 * the user reloads mid-failure, the queued write re-fires from the
 * fresh sync mount.
 */
export interface SyncFailure {
  /** Operation label in the form `<table>.<verb>` (e.g.
   *  `income_sources.upsert`). */
  label: string
  /** Raw Supabase error message, trimmed. */
  message: string
  /** First-seen timestamp; kept as ISO so the UI can format relative. */
  firstSeenAt: string
  /** How many times this exact failure has repeated. Bumped on
   *  duplicate (label + message) pushes so the UI can show "(×3)". */
  attemptCount: number
}

interface SyncFailuresState {
  failures: SyncFailure[]
  /**
   * Replace the current set of failures with the latest flush result.
   * Deduplicates by (label + message) and bumps `attemptCount` for
   * repeats. Empty array = no active failures (sync succeeded).
   */
  recordFailures: (errors: ReadonlyArray<string>) => void
  /** Manual dismiss — clears the whole list. Auto-cleared on a
   *  successful flush via `recordFailures([])`. */
  clear: () => void
}

function parseLabel(raw: string): { label: string; message: string } {
  // OpRunner produces strings of the form `<label>: <error message>`.
  // Split on the first `: ` to preserve colons inside the message.
  const idx = raw.indexOf(': ')
  if (idx < 0) return { label: 'unknown', message: raw }
  return { label: raw.slice(0, idx), message: raw.slice(idx + 2) }
}

export const useSyncFailures = create<SyncFailuresState>((set) => ({
  failures: [],
  recordFailures: (errors) => {
    set((state) => {
      if (errors.length === 0) {
        return state.failures.length === 0 ? state : { failures: [] }
      }
      const prevByKey = new Map(state.failures.map((f) => [`${f.label}::${f.message}`, f]))
      const now = new Date().toISOString()
      const next: SyncFailure[] = errors.map((raw) => {
        const { label, message } = parseLabel(raw)
        const key = `${label}::${message}`
        const prev = prevByKey.get(key)
        return prev
          ? { ...prev, attemptCount: prev.attemptCount + 1 }
          : { label, message, firstSeenAt: now, attemptCount: 1 }
      })
      return { failures: next }
    })
  },
  clear: () => set({ failures: [] }),
}))
