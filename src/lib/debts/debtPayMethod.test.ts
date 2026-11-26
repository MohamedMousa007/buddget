import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/lib/store/types'
import { debtPayMethodId } from './debtPayMethod'
import { isPaymentMethodReferenced, removePaymentMethod } from '@/lib/accounts/removePaymentMethod'

const pm = (id: string, extra: Partial<PaymentMethod> = {}) => ({ id, name: id, type: 'debit_card', createdAt: '2026-01-01', ...extra }) as unknown as PaymentMethod

describe('debtPayMethodId', () => {
  const methods = [pm('cib', { isDefault: true }), pm('nbe'), pm('old', { closedAt: '2026-05-01T00:00:00Z' })]

  it('starts on the plan’s default card', () => {
    expect(debtPayMethodId({ defaultPaymentMethodId: 'nbe' }, methods)).toBe('nbe')
  })

  it('falls back to the app default when the plan has none', () => {
    expect(debtPayMethodId({}, methods)).toBe('cib')
    expect(debtPayMethodId(undefined, methods)).toBe('cib')
  })

  it('ignores a default card that was closed or deleted', () => {
    expect(debtPayMethodId({ defaultPaymentMethodId: 'old' }, methods)).toBe('cib')
    expect(debtPayMethodId({ defaultPaymentMethodId: 'gone' }, methods)).toBe('cib')
  })
})

describe('a card used as a plan default', () => {
  const empty = { expenses: [], incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], accountAdjustments: [], recurringDebtPayments: [], subscriptions: [], incomeSources: [], savingsAccounts: [] }
  const plan = { id: 'd1', name: 'iPhone', person: 'Installment', startingBalance: 0, currency: 'EGP', isGold: false, createdAt: '2026-01-01', debtType: 'installment', defaultPaymentMethodId: 'nbe' }
  const refs = { ...empty, debts: [plan] } as unknown as Parameters<typeof isPaymentMethodReferenced>[0]

  it('counts as a reference, so removing the card closes it instead of deleting it (the plan never points at a missing row)', () => {
    expect(isPaymentMethodReferenced(refs, 'nbe')).toBe(true)
    const out = removePaymentMethod({ ...refs, paymentMethods: [pm('cib'), pm('nbe')] }, 'nbe')
    expect(out?.closed).toBe(true)
    expect(out?.paymentMethods.find((m) => m.id === 'nbe')?.closedAt).toBeTruthy()
  })
})
