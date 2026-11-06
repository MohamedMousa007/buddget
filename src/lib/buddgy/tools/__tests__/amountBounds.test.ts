import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))

import { LEGACY_MAX_AMOUNT } from '@/lib/ai/legacyGuards'
import { MONEY_PARAMS, NON_MONEY_PARAMS } from '@/lib/buddgy/tools/amountGuard'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import type { JsonSchema } from '@/lib/buddgy/tools/spec'
import type { ToolContext } from '@/lib/buddgy/tools/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const BAD: [string, number][] = [['1e300', 1e300], ['Infinity', Infinity], ['NaN', NaN], ['negative', -5], ['-0', -0], ['over the ceiling', LEGACY_MAX_AMOUNT + 1]]

/** Every path to a number-typed parameter of a spec: `[ ['amount'], ['ops', 0, 'amount'] ... ]` with the leaf name. */
function numberPaths(schema: JsonSchema, path: (string | number)[] = []): { path: (string | number)[]; leaf: string }[] {
  if (schema.type === 'number' || schema.type === 'integer') return [{ path, leaf: String([...path].reverse().find((k) => typeof k === 'string')) }]
  if (schema.type === 'array' && schema.items) return numberPaths(schema.items, [...path, 0])
  if (schema.type === 'object') return Object.entries(schema.properties ?? {}).flatMap(([k, v]) => numberPaths(v, [...path, k]))
  return []
}

function place(path: (string | number)[], value: unknown): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let cur: Record<string | number, unknown> = root
  path.forEach((key, i) => {
    if (i === path.length - 1) cur[key] = value
    else {
      const next = typeof path[i + 1] === 'number' ? [] : {}
      cur[key] = next
      cur = next as Record<string | number, unknown>
    }
  })
  return root
}

const writes = [...TOOLS.values()].filter((t) => t.spec.kind === 'write')

describe('BAI-2 shared amount bound on every write tool', () => {
  it('every numeric parameter of every write spec is classified as money or not-money', () => {
    const unknown = writes.flatMap((t) => numberPaths(t.spec.params).filter((p) => !MONEY_PARAMS.has(p.leaf) && !NON_MONEY_PARAMS.has(p.leaf)).map((p) => `${t.spec.name}.${p.leaf}`))
    expect(unknown).toEqual([])
  })

  const cases = writes.flatMap((t) => numberPaths(t.spec.params).filter((p) => MONEY_PARAMS.has(p.leaf) && typeof p.path[p.path.length - 1] === 'string').flatMap((p) => BAD.map(([label, value]) => ({ tool: t.spec.name, path: p.path, label, value }))))

  it('covers the write tools that take money', () => {
    const tools = new Set(cases.map((c) => c.tool))
    for (const name of ['add_expense', 'update_expense', 'add_income', 'update_income', 'mark_payday_received', 'add_debt', 'add_installment_plan', 'add_credit_card', 'update_debt', 'add_subscription', 'update_subscription', 'add_goal', 'update_goal', 'add_to_goal', 'deposit_to_savings', 'add_savings_account', 'correct_savings_balance', 'add_investment_holding', 'update_investment_holding', 'update_profile', 'adjust_budget']) {
      expect(tools.has(name), name).toBe(true)
    }
  })

  it.each(cases.map((c) => [`${c.tool} ${c.path.join('.')} = ${c.label}`, c] as const))('%s is refused before the executor runs', (_name, c) => {
    const r = TOOLS.get(c.tool)!.write!.propose(place(c.path, c.value), ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/The amount/)
  })

  it('does not refuse a normal amount at the guard (the executor decides the rest)', () => {
    const r = TOOLS.get('deposit_to_savings')!.write!.propose({ pocket: 'nope', amount: 250 }, ctx)
    if (!r.ok) expect(r.error).not.toMatch(/The amount/)
  })
})
