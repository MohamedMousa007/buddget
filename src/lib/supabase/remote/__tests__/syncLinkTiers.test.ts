import { describe, it, expect } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { Snapshot } from '@/lib/supabase/remote/snapshot'

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

async function commitOrder(next: Snapshot) {
  const committed: string[] = []
  const client = {
    from: (table: string) => ({
      upsert: () =>
        new Promise((resolve) => {
          setTimeout(() => { committed.push(table); resolve({ error: null }) }, table === 'income_events' || table === 'profiles' ? 0 : 5)
        }),
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  await flushDiff(client as never, 'u', emptySnapshot(), next)
  return (t: string) => committed.indexOf(t)
}

describe('flushDiff link-column FK order (Q9)', () => {
  const next = {
    ...emptySnapshot(),
    paymentMethods: [{ id: id(1), name: 'Cash', type: 'cash' }],
    debts: [{ id: id(2), name: 'Loan' }],
    savingsAccounts: [{ id: id(3), name: 'Vault' }],
    incomeSources: [{ id: id(4), name: 'Job', linkedDebtId: id(2), linkedSavingsAccountId: id(3) }],
    incomeEvents: [{ id: id(5), templateId: id(4), linkedDebtId: id(2), linkedSavingsAccountId: id(3), amount: 1, date: '2026-01-01' }],
    budgetPlans: [{ id: id(6), name: 'Plan', categories: [] }],
    activeBudgetPlanId: id(6),
    profile: { ...emptySnapshot().profile, defaultCarryPocketId: id(3) },
  } as unknown as Snapshot

  it('commits debts and pockets before income sources, and sources before the events that reference them', async () => {
    const at = await commitOrder(next)
    expect(at('debts')).toBeLessThan(at('income_sources'))
    expect(at('savings_accounts')).toBeLessThan(at('income_sources'))
    expect(at('income_sources')).toBeLessThan(at('income_events'))
  })

  it('commits the plan and the carry pocket before the profile row that points at them', async () => {
    const at = await commitOrder(next)
    expect(at('budget_plans')).toBeGreaterThanOrEqual(0)
    expect(at('budget_plans')).toBeLessThan(at('profiles'))
    expect(at('savings_accounts')).toBeLessThan(at('profiles'))
  })
})

describe('flushDiff holdings tier and per-row retry', () => {
  it('commits a pocket before the holding that references it', async () => {
    const next = {
      ...emptySnapshot(),
      savingsAccounts: [{ id: id(3), name: 'Vault' }],
      investmentHoldings: [{ id: id(7), accountId: id(3), name: 'Gold' }],
    } as unknown as Snapshot
    const at = await commitOrder(next)
    expect(at('savings_accounts')).toBeLessThan(at('savings_holdings'))
  })

  it.each(['23514', '23503'])('a %s on one row does not block the other rows of the batch', async (code) => {
    const saved: string[] = []
    const client = {
      from: () => ({
        upsert: (rows: { id: string; amount: number }[]) => {
          const bad = rows.some((r) => r.amount <= 0)
          if (bad && rows.length > 1) return Promise.resolve({ error: { message: 'batch rejected', code } })
          if (bad) return Promise.resolve({ error: { message: 'row rejected', code } })
          saved.push(...rows.map((r) => r.id))
          return Promise.resolve({ error: null })
        },
        update: () => ({ in: () => Promise.resolve({ error: null }) }),
      }),
    }
    const mk = (n: number, amount: number) => ({ id: id(n), amount, date: '2026-01-01', description: 'x', categoryId: null, paymentMethodId: null })
    const next = { ...emptySnapshot(), expenses: [mk(1, 10), mk(2, 0), mk(3, 5)] } as unknown as Snapshot
    const res = await flushDiff(client as never, 'u', emptySnapshot(), next)
    expect(saved).toEqual([id(1), id(3)])
    expect(res.anyError).toBe(true)
    expect(res.errors).toHaveLength(1)
  })
})
