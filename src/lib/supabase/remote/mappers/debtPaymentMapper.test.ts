import { describe, expect, it } from 'vitest'
import { debtPaymentFromRow, debtPaymentToRow } from './debtPaymentMapper'
import type { DebtPayment } from '@/lib/store/types'
import type { DebtPaymentRow } from '@/lib/supabase/remote/types'

const crossCurrency: DebtPayment = {
  id: 'p1', debtId: 'd1', date: '2026-10-01', amountPaid: 94, paymentCurrency: 'EGP',
  originalAmount: 4700, amountInPrimary: 4700, rateAtEntry: 50, createdAt: '2026-10-01',
}

describe('debt payment mapper units (D2)', () => {
  it('writes legacy amount/currency plus explicit unit columns, always with the same key set', () => {
    const row = debtPaymentToRow(crossCurrency, 'u1')
    expect(row).toMatchObject({
      amount: 94, currency: 'EGP', amount_in_debt_unit: 94,
      original_amount: 4700, original_currency: 'EGP', amount_in_base: 4700, rate_at_entry: 50,
    })
    const bare = debtPaymentToRow({ id: 'p2', debtId: 'd1', date: '2026-10-01', amountPaid: 5, createdAt: 'x' }, 'u1')
    expect(Object.keys(bare).sort()).toEqual(Object.keys(row).sort())
    expect(bare.original_amount).toBeNull()
  })

  it('round-trips a cross-currency payment without losing the paid amount', () => {
    const row = { ...debtPaymentToRow(crossCurrency, 'u1'), deleted_at: null, updated_at: 'x' } as DebtPaymentRow
    expect(debtPaymentFromRow(row)).toMatchObject({
      amountPaid: 94, paymentCurrency: 'EGP', originalAmount: 4700, amountInPrimary: 4700, rateAtEntry: 50,
    })
  })

  it('reads a legacy row (new columns NULL) as before', () => {
    const legacy = {
      id: 'p3', user_id: 'u1', debt_id: 'd1', amount: 100, currency: 'EGP', payment_date: '2026-10-01',
      payment_method_id: null, notes: null, funded_from_savings: false, occurred_at: null,
      created_at: 'x', updated_at: 'x', deleted_at: null,
      amount_in_debt_unit: null, original_amount: null, original_currency: null, amount_in_base: null, rate_at_entry: null,
    } as DebtPaymentRow
    expect(debtPaymentFromRow(legacy)).toMatchObject({
      amountPaid: 100, paymentCurrency: 'EGP', amountInPrimary: 100,
    })
    expect(debtPaymentFromRow(legacy).originalAmount).toBeUndefined()
    expect(debtPaymentFromRow(legacy).rateAtEntry).toBeUndefined()
  })

  it('a legacy gold payment (grams in amount, NULL original) reads as having no money amount', () => {
    const gold = {
      id: 'p4', user_id: 'u1', debt_id: 'g1', amount: 5, currency: 'EGP', payment_date: '2026-10-01',
      payment_method_id: 'pm', notes: null, funded_from_savings: false, occurred_at: null,
      created_at: 'x', updated_at: 'x', deleted_at: null,
      amount_in_debt_unit: 5, original_amount: null, original_currency: null, amount_in_base: null, rate_at_entry: null,
    } as DebtPaymentRow
    const p = debtPaymentFromRow(gold)
    expect(p.originalAmount).toBeUndefined()
    expect(p.amountPaid).toBe(5)
  })
})
