import { describe, expect, it } from 'vitest'
import { resendCashDebtPayments } from './v23_cash_debt_payment_resend'
import { baselineFromFingerprint, fingerprintOf } from '@/components/sync/flushedFingerprint'
import { emptySnapshot } from '@/lib/supabase/remote'
import { diffLists } from '@/lib/supabase/remote/diff'

const NOW = '2026-11-19T10:00:00.000Z'
// The shape addDebtPaymentWithExpense wrote before the fix: sentinel method, no updatedAt on the payment.
const payment = { id: 'p1', debtId: 'd1', date: '2026-11-18', amountPaid: 100, paymentMethodId: 'pm_default_cash', createdAt: '2026-11-18T09:00:00.000Z' }
const expense = { id: 'e1', linkedDebtPaymentId: 'p1', paymentMethodId: 'pm_default_cash', amount: 100, createdAt: '2026-11-18T09:00:00.000Z', updatedAt: '2026-11-18T09:00:00.000Z' }
const other = { id: 'e2', paymentMethodId: 'pm_default_cash', amount: 5, updatedAt: '2026-11-18T09:00:00.000Z' }
const sentinel = { id: 'pm_default_cash', name: 'Cash', type: 'cash', isDefault: true }

describe('v23 re-send of Cash debt payments', () => {
  it('points the payment at the real Cash account and re-stamps it with its expense', () => {
    const base: Record<string, unknown> = { paymentMethods: [sentinel, { id: 'real', name: 'Cash', type: 'cash', createdAt: '2026-01-01' }], debtPayments: [payment], expenses: [expense, other] }
    resendCashDebtPayments(base, NOW)
    expect(base.debtPayments).toEqual([{ ...payment, paymentMethodId: 'real', updatedAt: NOW }])
    expect(base.expenses).toEqual([{ ...expense, updatedAt: NOW }, other])
  })

  it('clears the method when there is no real Cash account, and leaves real methods alone', () => {
    const fine = { ...payment, id: 'p2', paymentMethodId: 'bank' }
    const base: Record<string, unknown> = { paymentMethods: [sentinel], debtPayments: [payment, { ...payment, id: 'p3', paymentMethodId: '' }, fine], expenses: [] }
    resendCashDebtPayments(base, NOW)
    const [a, b, c] = base.debtPayments as { paymentMethodId?: string; updatedAt?: string }[]
    expect(a.paymentMethodId).toBeUndefined()
    expect(b.paymentMethodId).toBeUndefined()
    expect(c).toBe(fine)
  })

  it('a device that recorded the rows as delivered offers them again at the next start', () => {
    const before = { ...emptySnapshot(), debtPayments: [payment], expenses: [expense, other] } as never
    const fp = fingerprintOf(before)
    const base: Record<string, unknown> = { paymentMethods: [sentinel], debtPayments: [payment], expenses: [expense, other] }
    resendCashDebtPayments(base, NOW)
    const cache = { ...emptySnapshot(), debtPayments: base.debtPayments, expenses: base.expenses } as never as ReturnType<typeof emptySnapshot>
    const baseline = baselineFromFingerprint(cache, fp)
    expect(diffLists(cache.debtPayments, baseline.debtPayments).updates.map((r) => r.id)).toEqual(['p1'])
    expect(diffLists(cache.expenses, baseline.expenses).updates.map((r) => r.id)).toEqual(['e1'])
  })
})
