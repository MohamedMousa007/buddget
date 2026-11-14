import { describe, expect, it } from 'vitest'
import { adoptedLoggedIds, loggedChargesAdopted } from './adoptLogged'
import { applyDelta, type MappedDelta } from '@/lib/supabase/remote/delta'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { diffLists } from '@/lib/supabase/remote/diff'
import { baselineAfterFlush } from '@/components/sync/flushBaseline'

const e = (id: string, date: string, over = {}) => ({ id, date, linkedSubscriptionId: 's1', isRecurring: true, smsLogId: undefined as string | undefined, ...over })
const sms = { id: 'sms1', linkedSubscriptionId: 's1', smsLogId: 'log1', date: '2026-10-19' }

describe('loggedChargesAdopted', () => {
  it('replaces only the nearest app-written charge of the same cycle', () => {
    expect(loggedChargesAdopted([e('a', '2026-10-17'), e('b', '2026-10-18')], sms)).toEqual(['b'])
  })
  it('keeps charges from other cycles, other subscriptions, real SMS rows and manual expenses', () => {
    const list = [e('far', '2026-09-19'), e('other', '2026-10-19', { linkedSubscriptionId: 's2' }), e('real', '2026-10-19', { smsLogId: 'x' }), e('manual', '2026-10-19', { isRecurring: false })]
    expect(loggedChargesAdopted(list, sms)).toEqual([])
  })
  it('does nothing for an incoming charge that has no SMS behind it', () => {
    expect(loggedChargesAdopted([e('a', '2026-10-19')], { ...sms, smsLogId: undefined })).toEqual([])
  })
})

describe('adoption after a sync, as production runs it', () => {
  const none = { upserts: [], deletedIds: [] }
  const delta = (upserts: unknown[]) => ({
    cursor: 'c', profile: null, settings: null,
    paymentMethods: none, incomeSources: none, incomeEvents: none, expenses: { upserts, deletedIds: [] }, receipts: none, recurringExpenses: none,
    subscriptions: none, debts: none, debtPayments: none, recurringDebtPayments: none, savingsAccounts: none, investmentHoldings: none,
    savingsTransactions: none, recurringSavingsDeposits: none, goals: none, buddgyMemories: none, accountAdjustments: none,
    budgetPlans: [], deletedBudgetPlanIds: [], budgetPlanActivations: [], deletedBudgetPlanActivationIds: [], staleBefore: null,
  }) as unknown as MappedDelta
  const row = (id: string, date: string, extra = {}) => ({ id, date, updatedAt: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', linkedSubscriptionId: 's1', isRecurring: true, ...extra })
  const snap = (rows: unknown[]) => ({ ...emptySnapshot(), expenses: rows as Snapshot['expenses'] })

  it('merges by id, sets the baseline, then the store delete shows up as a tombstone in the next diff', () => {
    const logged = row('app1', '2026-11-10')
    const incoming = row('sms1', '2026-11-12', { smsLogId: 'log1', isRecurring: false })
    const delivered = snap([logged])
    const merged = applyDelta(delivered, delta([incoming]), delivered)
    expect(merged.expenses.map((x) => x.id).sort()).toEqual(['app1', 'sms1'])
    const baseline = baselineAfterFlush(delivered, merged, true)!
    const ids = adoptedLoggedIds(merged.expenses, delta([incoming]).expenses.upserts)
    expect(ids).toEqual(['app1'])
    const afterDelete = merged.expenses.filter((x) => !ids.includes(x.id))
    expect(diffLists(afterDelete, baseline.expenses).deletes).toEqual(['app1'])
  })

  it('a second pull of the same charge adopts nothing once the logged row is gone', () => {
    const incoming = row('sms1', '2026-11-12', { smsLogId: 'log1', isRecurring: false })
    const local = snap([incoming])
    const merged = applyDelta(local, delta([incoming]), local)
    expect(adoptedLoggedIds(merged.expenses, [incoming as never])).toEqual([])
  })
})
