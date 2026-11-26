import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cardsToFollow, changeAccountCurrency } from '../actions'

const s = () => useFinanceStore.getState()
const pm = (id: string) => s().paymentMethods.find((m) => m.id === id)!

describe('account currency change and its cards (council decision)', () => {
  let bank = ''
  let debit = ''
  let prepaid = ''
  let credit = ''
  let otherDebit = ''
  beforeEach(() => {
    s().reset()
    bank = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    const other = s().addPaymentMethod({ name: 'NBE', type: 'bank_account', currency: 'EGP', isDefault: false })
    debit = s().addPaymentMethod({ name: 'CIB debit', type: 'debit_card', currency: 'EGP', isDefault: false, parentId: bank, last4: '1111' })
    prepaid = s().addPaymentMethod({ name: 'CIB prepaid', type: 'prepaid_card', currency: 'EGP', isDefault: false, parentId: bank, last4: '2222' })
    credit = s().addPaymentMethod({ name: 'CIB credit', type: 'credit_card', currency: 'EGP', isDefault: false, parentId: bank, last4: '3333' })
    otherDebit = s().addPaymentMethod({ name: 'NBE debit', type: 'debit_card', currency: 'EGP', isDefault: false, parentId: other })
  })

  it('offers only the account\'s own debit and prepaid cards that differ from the new currency', () => {
    expect(cardsToFollow(s().paymentMethods, bank, 'USD').map((c) => c.id).sort()).toEqual([debit, prepaid].sort())
    expect(cardsToFollow(s().paymentMethods, bank, 'EGP')).toEqual([])
  })

  it('without card ids only the account changes', () => {
    changeAccountCurrency(bank, 'USD', 0)
    expect(pm(bank).currency).toBe('USD')
    expect([pm(debit), pm(prepaid), pm(credit)].map((c) => c.currency)).toEqual(['EGP', 'EGP', 'EGP'])
  })

  it('relabels the listed cards; a credit card or another account\'s card never changes', () => {
    changeAccountCurrency(bank, 'USD', 0, { cardIds: [debit, prepaid, credit, otherDebit] })
    expect([pm(debit), pm(prepaid)].map((c) => c.currency)).toEqual(['USD', 'USD'])
    expect(pm(credit).currency).toBe('EGP')
    expect(pm(otherDebit).currency).toBe('EGP')
  })

  it('changes only the cards it is given', () => {
    changeAccountCurrency(bank, 'USD', 0, { cardIds: [debit] })
    expect(pm(debit).currency).toBe('USD')
    expect(pm(prepaid).currency).toBe('EGP')
  })

  it('past transactions keep their amount and currency', () => {
    s().addExpense({ occurredAt: new Date().toISOString(), description: 'Coffee', category: 'Food', amount: 120, currency: 'EGP', date: '2026-11-01', paymentMethodId: debit, isRecurring: false })
    changeAccountCurrency(bank, 'USD', 0, { cardIds: [debit] })
    expect(s().expenses.at(-1)).toMatchObject({ amount: 120, currency: 'EGP', paymentMethodId: debit })
  })
})
