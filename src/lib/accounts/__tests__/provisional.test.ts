import { describe, expect, it } from 'vitest'
import type { Expense, IncomeEvent, PaymentMethod } from '@/lib/store/types'
import { planMerge, provisionalAsDetected, provisionalIdOf, provisionalKey } from '@/lib/accounts/provisional'
import { isOpenAccount, isTracked } from '@/lib/accounts/kinds'
import { smsAccountLabelKind } from '@/lib/accounts/unplacedSms'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

const pm = (over: Partial<PaymentMethod>): PaymentMethod => ({ id: 'x', name: 'CIB ••1234', type: 'bank_account', currency: 'EGP', isDefault: false, ...over } as PaymentMethod)
const prov = pm({ id: 'prov', last4: '1234', provisional: true })
const mine = pm({ id: 'mine', name: 'CIB ••7887', last4: '7887' })
const ledger = {
  expenses: [
    { id: 'e1', paymentMethodId: 'prov' },
    { id: 'e2', paymentMethodId: 'mine', toPaymentMethodId: 'prov' },
    { id: 'e3', paymentMethodId: 'mine' },
  ] as Expense[],
  incomeEvents: [{ id: 'i1', paymentMethodId: 'prov' }] as IncomeEvent[],
}

describe('provisional accounts', () => {
  it('never carry a balance, even with an opening balance set', () => {
    const withBalance = { openingBalance: 100, openingAt: '2026-11-01T00:00:00Z' }
    expect(isTracked(pm({ ...withBalance }))).toBe(true)
    expect(isTracked(pm({ ...withBalance, provisional: true }))).toBe(false)
  })

  it('stay out of the accounts list until answered', () => {
    expect(isOpenAccount(mine)).toBe(true)
    expect(isOpenAccount(prov)).toBe(false)
  })

  it('are listed for the user with the rows they carry', () => {
    expect(provisionalAsDetected([prov, mine], ledger)).toEqual([
      { key: provisionalKey('prov'), currency: 'EGP', provider: 'CIB', last4: '1234', type: 'bank_account', count: 3 },
    ])
    expect(provisionalIdOf(provisionalKey('prov'))).toBe('prov')
    expect(provisionalIdOf('acct:1234')).toBeNull()
  })

  it('merge moves every row and teaches the target the digits', () => {
    const plan = planMerge([prov, mine], ledger, 'prov', 'mine')
    expect(plan?.rows).toEqual({ expenseIds: ['e1'], toExpenseIds: ['e2'], incomeIds: ['i1'] })
    expect(plan?.targetPatch).toEqual({ last4Aliases: ['1234'] })
    // Everything Undo needs to put it back.
    expect(plan?.removed).toBe(prov)
    expect(plan?.targetBefore).toEqual({ last4: '7887', last4Aliases: undefined })
  })

  it('refuses to merge into itself, a missing account or another provisional one', () => {
    expect(planMerge([prov, mine], ledger, 'prov', 'prov')).toBeNull()
    expect(planMerge([prov, mine], ledger, 'prov', 'nope')).toBeNull()
    expect(planMerge([prov, mine], ledger, 'mine', 'prov')).toBeNull()
    expect(planMerge([prov, pm({ id: 'p2', provisional: true })], ledger, 'prov', 'p2')).toBeNull()
  })
})

describe('smsAccountLabelKind', () => {
  it('shows a bank-message expense with no account as Unassigned, never Cash', () => {
    expect(smsAccountLabelKind({ smsLogId: 'log', paymentMethodId: DEFAULT_CASH_ID })).toBe('unassigned')
    expect(smsAccountLabelKind({ smsLogId: 'log', paymentMethodId: '' })).toBe('unassigned')
  })

  it('leaves a manual cash expense and a placed message alone', () => {
    expect(smsAccountLabelKind({ smsLogId: undefined, paymentMethodId: DEFAULT_CASH_ID })).toBe('method')
    expect(smsAccountLabelKind({ smsLogId: 'log', paymentMethodId: 'mine' })).toBe('method')
  })
})
