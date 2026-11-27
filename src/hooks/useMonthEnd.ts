'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { apiFetchAuth } from '@/lib/apiBase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { revertAchievedForMonthEndUndo } from '@/lib/goals/reconcileAchievedGoals'
import type { MonthEndView } from '@/lib/server/monthEnd'
import type { SplitEntry } from '@/lib/monthEnd/proposal'

export type MonthEndResult = 'ok' | 'conflict' | 'failed'

async function post(body: object): Promise<{ status: number; json: { view?: MonthEndView | null; error?: string; notUndone?: { amount: number }[]; reverted?: string[] } | null }> {
  try {
    const res = await apiFetchAuth('/api/month-end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: res.status, json: await res.json().catch(() => null) }
  } catch {
    return { status: 0, json: null }
  }
}

/**
 * The month-end card (LOGIC_SPEC §4.4): proposed on opening Savings (the first open after a cycle ends creates it),
 * then Confirm / Undo / the split. The server owns every figure; after a write the store pulls the new parts, labels
 * and goals. Offline or signed out: no card.
 */
export function useMonthEnd() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [view, setView] = useState<MonthEndView | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!uid) return
    let live = true
    void post({ op: 'propose' }).then((r) => { if (live && r.json && 'view' in r.json) setView(r.json.view ?? null) })
    return () => { live = false }
  }, [uid])

  /** `local` runs on success before the pull, so the merge already sees this device's copy as the server left it. */
  const run = useCallback(async (body: object, local?: (reverted: string[]) => void): Promise<{ result: MonthEndResult; notUndone: number; reverted: string[] }> => {
    setBusy(true)
    const r = await post(body)
    setBusy(false)
    if (r.json?.view !== undefined) setView(r.json.view ?? null)
    if (r.status === 200) {
      local?.(r.json?.reverted ?? [])
      void syncFinanceNow().catch(() => undefined)
    }
    const notUndone = (r.json?.notUndone ?? []).reduce((s, x) => s + x.amount, 0)
    return { result: r.status === 200 ? 'ok' : r.status === 409 ? 'conflict' : 'failed', notUndone, reverted: r.json?.reverted ?? [] }
  }, [])

  const confirm = useCallback(() => (view ? run({ op: 'apply', id: view.id, version: view.version }) : Promise.resolve({ result: 'failed' as const, notUndone: 0, reverted: [] })), [view, run])
  const undo = useCallback(async () => {
    if (!view) return { result: 'failed' as const, notUndone: 0, reverted: [] }
    // §0: the goals this month-end completed are active again (the server did it in the same transaction). Before the
    // pull: merge keeps an achieved copy over an active one (I-12), so a still-achieved local copy would win.
    return run({ op: 'undo', id: view.id }, (reverted) => {
      if (reverted.length) useFinanceStore.setState((s) => ({ goals: revertAchievedForMonthEndUndo(s.goals, reverted) }))
    })
  }, [view, run])
  const saveSplit = useCallback(async (split: SplitEntry[]) => {
    // Shown at once; the pull brings the same split from the server.
    return run({ op: 'split', split }, () => useFinanceStore.setState((s) => ({ profile: { ...s.profile, savingsSplit: split } })))
  }, [run])

  return { view, busy, confirm, undo, saveSplit }
}
