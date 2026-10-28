import { describe, it, expect } from 'vitest'
import { flushDiff, pullAll } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { Snapshot } from '@/lib/supabase/remote/snapshot'

describe('flushDiff FK order', () => {
  it('commits parents before the children that reference them', async () => {
    const committed: string[] = []
    const client = {
      from: (table: string) => ({
        upsert: () =>
          new Promise((resolve) => {
            setTimeout(() => {
              committed.push(table)
              resolve({ error: null })
            }, table === 'expenses' ? 0 : 5)
          }),
        update: () => ({ in: () => Promise.resolve({ error: null }) }),
      }),
    }
    const row = { id: '00000000-0000-4000-8000-000000000001' }
    const next = {
      ...emptySnapshot(),
      paymentMethods: [{ ...row, name: 'Card', type: 'credit_card' }],
      debts: [{ ...row, name: 'Loan' }],
      debtPayments: [{ ...row, debtId: row.id, amount: 1 }],
      expenses: [{ ...row, amount: 1, date: '2026-01-01' }],
      incomeSources: [{ ...row, name: 'Job' }],
      savingsAccounts: [{ ...row, name: 'Vault' }],
      savingsTransactions: [{ ...row, accountId: row.id }],
    } as unknown as Snapshot
    await flushDiff(client as never, 'u', emptySnapshot(), next)
    const at = (t: string) => committed.indexOf(t)
    expect(at('payment_methods')).toBeLessThan(at('debts'))
    expect(at('debts')).toBeLessThan(at('debt_payments'))
    expect(at('debt_payments')).toBeLessThan(at('expenses'))
    expect(at('payment_methods')).toBeLessThan(at('income_sources'))
    expect(at('payment_methods')).toBeLessThan(at('savings_accounts'))
    expect(at('savings_accounts')).toBeLessThan(at('savings_transactions'))
    expect(at('payment_methods')).toBeLessThan(at('income_sources'))
    expect(at('payment_methods')).toBeLessThan(at('savings_accounts'))
    expect(at('savings_accounts')).toBeLessThan(at('savings_transactions'))
  })
})

function pullClient(opts: { failTable?: string; expenseCount?: number }) {
  const calls: Array<[number, number]> = []
  return {
    calls,
    client: {
      from: (table: string) => {
        let cursor = 0
        const page = (size: number) => {
          const from = cursor
          if (table === 'expenses') calls.push([from, from + size - 1])
          if (table === opts.failTable) return { data: null, error: { message: 'boom' } }
          const total = table === 'expenses' ? (opts.expenseCount ?? 0) : 0
          const n = Math.max(0, Math.min(from + size, total) - from)
          return { data: Array.from({ length: n }, (_, i) => ({ id: `${from + i}` })), error: null }
        }
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          order: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: table === 'profiles' ? { id: 'u', base_currency: 'USD' } : null,
              error: null,
            }),
          limit: (size: number) => {
            const q = {
              gt: (_c: string, v: string) => {
                cursor = Number(v) + 1
                return q
              },
              then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(page(size)).then(res, rej),
            }
            return q
          },
        }
        return chain
      },
    },
  }
}

describe('pullAll', () => {
  it('throws when a table query errors instead of treating it as no rows', async () => {
    const { client } = pullClient({ failTable: 'debts' })
    await expect(pullAll(client as never, 'u')).rejects.toThrow(/debts/)
  })

  it('pages tables larger than one page', async () => {
    const { client, calls } = pullClient({ expenseCount: 2500 })
    await pullAll(client as never, 'u').catch(() => undefined)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
})
