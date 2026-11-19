import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { emptySnapshot, flushDiff, type Snapshot } from '@/lib/supabase/remote'
import { holdParkedBack } from '@/lib/supabase/remote/parkedRows'
import { baselineAfterFlush } from '@/components/sync/flushBaseline'
import { fingerprintOf, baselineFromFingerprint } from '@/components/sync/flushedFingerprint'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import type { Debt, DebtPayment, Expense } from '@/lib/store/types'
import { liveClient } from './liveClient'

/**
 * QA-030 / SYNC-001 + SYNC-002. Replays exactly what SupabaseFinanceSync does for "Debts > Instalments > Pay next from Cash":
 *   1. a debounced flush() -> flushDiff -> rows parked -> holdParkedBack keeps them unsent (correct)
 *   2. the reconcile (pendingSync, SupabaseFinanceSync.ts:395) then re-baselines on the whole store with flushed=true,
 *      so the parked rows become "delivered" and their hashes land in buddget:flushed:<uid>.
 */
describe('QA-030 debt payment from Cash never reaches the server', () => {
  it('reproduces 400 + 409, then the reconcile marks both rows delivered', async () => {
    const { client, userId, wire } = await liveClient('qa-sync-1@buddget-qa.test')
    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    const debt = {
      id: randomUUID(), name: 'QA030 instalment', person: 'QA', startingBalance: 6000, currency: 'EGP', isGold: false,
      createdAt: now, updatedAt: now, debtType: 'installment', installmentCount: 12, installmentAmount: 500,
      installmentFrequency: 'monthly', startDate: today, direction: 'i_owe',
    } as unknown as Debt

    // Flush 0: the debt itself (lands).
    const s0 = emptySnapshot()
    const s1: Snapshot = { ...s0, debts: [debt] }
    const r0 = await flushDiff(client, userId, s0, s1)
    expect(r0.anyError).toBe(false)
    expect(r0.parked).toEqual([])

    // The pay-next action: a debt payment from Cash and its linked expense.
    const payment: DebtPayment = {
      id: randomUUID(), debtId: debt.id, date: today, amountPaid: 500, paymentMethodId: DEFAULT_CASH_ID,
      paymentCurrency: 'EGP', amountInPrimary: 500, createdAt: now, updatedAt: now,
    } as DebtPayment
    const expense = {
      id: randomUUID(), date: today, description: 'QA030 instalment', category: 'Debt', amount: 500, currency: 'EGP',
      amountInBaseCurrency: 500, paymentMethodId: DEFAULT_CASH_ID, isRecurring: false, isDebtPayment: true,
      linkedDebtPaymentId: payment.id, linkedDebtId: debt.id, createdAt: now, updatedAt: now,
    } as unknown as Expense
    const s2: Snapshot = { ...s1, debtPayments: [payment], expenses: [expense] }

    wire.length = 0
    const r1 = await flushDiff(client, userId, s1, s2)
    const failed = wire.filter((w) => w.status >= 400)
    writeFileSync('e2e/sync/evidence/qa030-wire.json', JSON.stringify(failed, null, 2))
    // No error is reported (the banner only shows the transient "set aside" count), both rows are parked.
    expect(r1.anyError).toBe(false)
    expect(r1.parked?.map((p) => [p.table, p.code]).sort()).toEqual([['debt_payments', '22P02'], ['expenses', '23503']])
    expect(failed.map((w) => `${w.method} ${w.path.split('?')[0]} ${w.status}`)).toEqual([
      'POST /rest/v1/debt_payments 400',
      'POST /rest/v1/expenses 409',
    ])

    // Step 1 (flush(), SupabaseFinanceSync.ts:338): parked rows are held back. Correct.
    const afterFlush = holdParkedBack(s2, s1, r1.parked ?? [])
    expect(afterFlush.debtPayments).toEqual([])
    expect(afterFlush.expenses).toEqual([])

    // Step 2 (pendingSync, SupabaseFinanceSync.ts:395): flushed === true because parked is not anyError,
    // so the baseline becomes the whole store, parked rows included.
    const afterReconcile = baselineAfterFlush(afterFlush, s2, true)!
    const fp = fingerprintOf(afterReconcile)
    expect(Object.keys(fp.lists.debtPayments)).toEqual([payment.id])
    expect(Object.keys(fp.lists.expenses)).toEqual([expense.id])

    // Consequence: every later flush (and every warm boot, via the fingerprint) sees nothing to send.
    wire.length = 0
    const r2 = await flushDiff(client, userId, afterReconcile, s2)
    expect(r2.writes).toBe(0)
    const boot = baselineFromFingerprint(s2, fp)
    const r3 = await flushDiff(client, userId, boot, s2)
    expect(r3.writes).toBe(0)

    // Server truth: neither row exists.
    const dp = await client.from('debt_payments').select('id').eq('id', payment.id)
    const ex = await client.from('expenses').select('id').eq('id', expense.id)
    expect(dp.data).toEqual([])
    expect(ex.data).toEqual([])
  })

  it('control: the same payment from a real account (uuid) syncs', async () => {
    const { client, userId } = await liveClient('qa-sync-1@buddget-qa.test')
    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    const pm = { id: randomUUID(), name: 'QA bank', type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: now, updatedAt: now }
    const debt = { id: randomUUID(), name: 'QA030 ctrl', person: 'QA', startingBalance: 1000, currency: 'EGP', isGold: false, createdAt: now, updatedAt: now } as unknown as Debt
    const s0 = emptySnapshot()
    const s1 = { ...s0, debts: [debt], paymentMethods: [pm] } as unknown as Snapshot
    const r0 = await flushDiff(client, userId, s0, s1)
    expect(r0.errors).toEqual([])
    expect(r0.parked).toEqual([])
    const payment = { id: randomUUID(), debtId: debt.id, date: today, amountPaid: 100, paymentMethodId: pm.id, paymentCurrency: 'EGP', createdAt: now, updatedAt: now } as DebtPayment
    const r1 = await flushDiff(client, userId, s1, { ...s1, debtPayments: [payment] })
    expect(r1.parked).toEqual([])
    const dp = await client.from('debt_payments').select('id').eq('id', payment.id)
    expect(dp.data).toEqual([{ id: payment.id }])
  })
})
