/**
 * Union-by-id merge used by every `useHydrate*` hook when reconciling the
 * server snapshot with live Zustand state.
 *
 * Why this exists
 * ---------------
 * The naive `setState({ incomeSources: res.data.map(...) })` in a hydrate
 * hook is a BLIND REPLACE. It destroys any locally-added row that hasn't
 * been flushed to the server yet — which is exactly the state a user is
 * in during the onboarding Journey (rows debounced for 500 ms, pushes
 * queued, hydration may fire on the post-journey route before the push
 * round-trips). The observed symptom: "I added an income during
 * onboarding and after landing on /budget-setup it was gone."
 *
 * The merge semantics mirror `mergeSnapshots` in the sync layer:
 *   - Union by `id`.
 *   - If the same id exists in both, prefer the one with the newer
 *     `updatedAt` (falling back to `createdAt`, then server as the safer
 *     default).
 *   - Local-only rows are kept; they'll reach the server on the next
 *     debounced push.
 */

export interface MergableRow {
  id: string
  updatedAt?: string
  createdAt?: string
}

export function mergeById<T extends MergableRow>(local: T[], server: T[]): T[] {
  const byId = new Map<string, T>()
  for (const r of server) byId.set(r.id, r)
  for (const l of local) {
    const s = byId.get(l.id)
    if (!s) {
      byId.set(l.id, l)
      continue
    }
    const lt = l.updatedAt || l.createdAt || ''
    const st = s.updatedAt || s.createdAt || ''
    if (lt > st) byId.set(l.id, l)
    // else keep server
  }
  return Array.from(byId.values())
}
