import { apiFetchAuth } from '@/lib/apiBase'
import type { AdjustLine, AdjustResult } from '@/lib/budget/budgetAi'
import type { BudgetFacts, PlanDraft } from '@/lib/budget/facts'

type Outcome<T> = { ok: true; data: T } | { ok: false; reason: 'quota' | 'unavailable' | 'failed' }

async function call<T>(body: unknown, signal?: AbortSignal): Promise<Outcome<T>> {
  try {
    const res = await apiFetchAuth('/api/budget/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (res.status === 429) return { ok: false, reason: 'quota' }
    if (res.status === 503 || res.status === 401) return { ok: false, reason: 'unavailable' }
    if (!res.ok) return { ok: false, reason: 'failed' }
    const json = (await res.json()) as { data?: T }
    return json.data ? { ok: true, data: json.data } : { ok: false, reason: 'failed' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** Engine draft in, the model's refinement out (fold it in with `applyRefinement`). Any failure is a reason, never a throw. */
export const refineDraft = (facts: BudgetFacts, draft: PlanDraft, signal?: AbortSignal) =>
  call<unknown>({ op: 'build', facts, draft }, signal)

/** What the user wrote about their situation, as studio answers (question id to value). */
export const readSituation = (text: string, currency: string, signal?: AbortSignal) =>
  call<Record<string, unknown>>({ op: 'situation', text, currency }, signal)

export const requestAdjust = (lines: AdjustLine[], text: string, currency: string, income: number, signal?: AbortSignal) =>
  call<AdjustResult>({ op: 'adjust', lines, text, currency, income }, signal)
