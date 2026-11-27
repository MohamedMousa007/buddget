import { flushFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { apiFetchAuth } from '@/lib/apiBase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SplitEntry } from './proposal'

/** The split with one target id replaced (a pocket moved whole gets a new row, §4.7); null when it has no entry for it. */
export function remapSplitEntries(split: readonly SplitEntry[] | undefined, from: string, to: string): SplitEntry[] | null {
  if (!split?.some((e) => e.target_id === from)) return null
  return split.map((e) => (e.target_id === from ? { ...e, target_id: to } : e))
}

/** After movePocket: shown at once, then saved through the split's only writer once the new row has synced. */
export async function remapSplitAfterMove(from: string, to: string): Promise<void> {
  const next = remapSplitEntries(useFinanceStore.getState().profile.savingsSplit, from, to)
  if (!next) return
  useFinanceStore.setState((s) => ({ profile: { ...s.profile, savingsSplit: next } }))
  await flushFinanceNow().catch(() => false)
  await apiFetchAuth('/api/month-end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'split', split: next }) }).catch(() => undefined)
}
