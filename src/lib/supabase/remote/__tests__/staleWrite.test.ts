import { afterEach, describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import { applyDelta, type MappedDelta } from '@/lib/supabase/remote/delta'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { noteServerTime, resetServerClock } from '@/lib/supabase/remote/serverClock'
import type { Expense } from '@/lib/store/types'

const expense = (amount: number, updatedAt: string): Expense => ({
  id: 'e1', date: '2026-10-10', description: 'Lunch', category: 'Food', amount, currency: 'EGP', amountInBaseCurrency: amount,
  paymentMethodId: '', isRecurring: false, createdAt: '2026-10-01T00:00:00Z', updatedAt,
})

type Row = Record<string, unknown> & { id: string; amount: number; updated_at: string }

/** The server side of `a0_reject_stale_write` + `set_updated_at`, one `expenses` table. */
function fakeServer(clock: { now: string }) {
  const rows = new Map<string, Row>()
  const client = {
    from: (table: string) => ({
      upsert: (batch: Row[]) => {
        let written = 0
        if (table === 'expenses') {
          for (const row of batch) {
            const old = rows.get(row.id)
            if (old && Date.parse(row.updated_at) < Date.parse(old.updated_at) - 60_000) continue
            rows.set(row.id, { ...old, ...row, updated_at: clock.now })
            written++
          }
        }
        return Promise.resolve({ error: null, count: written })
      },
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { client, rows }
}

const noDelta = (expenses: Expense[]): MappedDelta => {
  const none = { upserts: [], deletedIds: [] }
  return {
    cursor: '', profile: null, settings: null, paymentMethods: none, incomeSources: none, incomeEvents: none, expenses: { upserts: expenses, deletedIds: [] },
    receipts: none, recurringExpenses: none, subscriptions: none, debts: none, debtPayments: none, recurringDebtPayments: none, savingsAccounts: none,
    investmentHoldings: none, savingsTransactions: none, recurringSavingsDeposits: none, goals: none, buddgyMemories: none, accountAdjustments: none,
    budgetPlans: [], deletedBudgetPlanIds: [], budgetPlanActivations: [], deletedBudgetPlanActivationIds: [], staleBefore: null,
  }
}

const withExpense = (e: Expense) => ({ ...emptySnapshot(), expenses: [e] })

afterEach(() => resetServerClock())

describe('SYN6: a stale offline edit does not overwrite a newer edit from another device', () => {
  it('B (offline since the 3rd, edit of the 4th) pushes after A (edit of the 10th): A stays, B is told to re-pull and converges on A', async () => {
    const clock = { now: '2026-10-10T10:00:00.000+00:00' }
    const { client, rows } = fakeServer(clock)
    const base = expense(10, '2026-10-03T00:00:00Z')
    await flushDiff(client as never, 'u1', emptySnapshot(), withExpense(base))

    // A edits on the 10th and pushes.
    await flushDiff(client as never, 'u1', withExpense(base), withExpense(expense(99, '2026-10-10T09:59:00Z')))
    expect(rows.get('e1')?.amount).toBe(99)

    // B was offline with the 3rd's copy, edited it on the 4th, reconnects on the 12th.
    clock.now = '2026-10-12T08:00:00.000+00:00'
    const bEdit = expense(55, '2026-10-04T12:00:00Z')
    const result = await flushDiff(client as never, 'u1', withExpense(base), withExpense(bEdit))
    expect(rows.get('e1')?.amount).toBe(99)
    expect(result.skippedWrites).toBe(1)

    // The re-pull brings A's row; B's older edit loses on the merge too.
    const server = expenseFromRow(rows.get('e1') as never)
    const merged = applyDelta(withExpense(bEdit), noDelta([server]))
    expect(merged.expenses[0].amount).toBe(99)
  })

  it('a newer edit from the offline device still wins, and nothing is skipped', async () => {
    const clock = { now: '2026-10-10T10:00:00.000+00:00' }
    const { client, rows } = fakeServer(clock)
    const base = expense(10, '2026-10-03T00:00:00Z')
    await flushDiff(client as never, 'u1', emptySnapshot(), withExpense(base))
    clock.now = '2026-10-12T08:00:00.000+00:00'
    const result = await flushDiff(client as never, 'u1', withExpense(base), withExpense(expense(77, '2026-10-11T00:00:00Z')))
    expect(rows.get('e1')?.amount).toBe(77)
    expect(result.skippedWrites).toBe(0)
  })

  it('two quick edits on one device, the second made before the first reached the server, both land', async () => {
    const clock = { now: '2026-10-10T10:00:05.000+00:00' }
    const { client, rows } = fakeServer(clock)
    const base = expense(10, '2026-10-03T00:00:00Z')
    await flushDiff(client as never, 'u1', emptySnapshot(), withExpense(base))
    const first = expense(20, '2026-10-10T10:00:00Z')
    clock.now = '2026-10-10T10:00:05.000+00:00' // server receipt 5 s after the edit
    await flushDiff(client as never, 'u1', withExpense(base), withExpense(first))
    const second = expense(30, '2026-10-10T10:00:02Z') // made while the first was in flight
    await flushDiff(client as never, 'u1', withExpense(first), withExpense(second))
    expect(rows.get('e1')?.amount).toBe(30)
  })

  it('sends the edit time on the server clock: a device 2 h behind is not mistaken for stale', async () => {
    // Device clock is 2 h behind the server; the last pull told it so.
    const realNow = Date.now()
    noteServerTime(new Date(realNow + 2 * 3_600_000).toISOString())
    const clock = { now: new Date(realNow + 2 * 3_600_000 - 600_000).toISOString() } // server stamp 10 min ago
    const { client, rows } = fakeServer(clock)
    rows.set('e1', { id: 'e1', amount: 10, updated_at: clock.now })
    const base = expense(10, clock.now)
    const editedNow = new Date(realNow).toISOString() // 2 h behind on the wall, but later than the server stamp once corrected
    clock.now = new Date(realNow + 2 * 3_600_000).toISOString()
    const result = await flushDiff(client as never, 'u1', withExpense(base), withExpense(expense(42, editedNow)))
    expect(rows.get('e1')?.amount).toBe(42)
    expect(result.skippedWrites).toBe(0)
  })
})
