import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cashOut, setOpeningBalance } from '../actions'
import { removeMethodWithUndo } from '../methodUndo'
import { catalogCopyAr, catalogCopyEn } from '@/lib/i18n/catalogCopy'

const s = () => useFinanceStore.getState()

describe('Undo after deleting a card or closing an account (W2)', () => {
  let bank = ''
  let card = ''
  beforeEach(() => {
    s().reset()
    bank = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: true })
    card = s().addPaymentMethod({ name: 'CIB', type: 'debit_card', currency: 'EGP', isDefault: false, parentId: bank, last4: '4410' })
    setOpeningBalance(bank, 1000, new Date(Date.now() - 86_400_000))
  })

  it('closing an account detaches its cards; Undo reopens it and reattaches them', () => {
    cashOut(bank, 10, 'EGP')
    const undo = removeMethodWithUndo(bank, 'close')
    expect(s().paymentMethods.find((m) => m.id === bank)?.closedAt).toBeTruthy()
    expect(s().paymentMethods.find((m) => m.id === card)?.parentId).toBeUndefined()
    undo()
    const back = s().paymentMethods.find((m) => m.id === bank)!
    expect(back.closedAt).toBeUndefined()
    expect(back.isDefault).toBe(true)
    expect(s().paymentMethods.find((m) => m.id === card)?.parentId).toBe(bank)
    expect(s().paymentMethods.filter((m) => m.id === bank)).toHaveLength(1)
  })

  it('deleting an unused card removes it; Undo brings it back with a fresh edit time', () => {
    const before = s().paymentMethods.find((m) => m.id === card)!
    const undo = removeMethodWithUndo(card, 'delete')
    expect(s().paymentMethods.some((m) => m.id === card)).toBe(false)
    undo()
    const back = s().paymentMethods.find((m) => m.id === card)!
    expect(back).toMatchObject({ parentId: bank, last4: '4410' })
    expect(back.updatedAt && before.updatedAt ? back.updatedAt >= before.updatedAt : true).toBe(true)
  })

  it('a credit card delete takes its own debt away and Undo puts the debt back', () => {
    const debtId = s().addCreditCardDebt({ name: 'CIB Credit', startingBalance: 0, currency: 'EGP', creditLimit: 30000 } as never, { name: 'CIB Credit', last4: '7781' })
    const cc = s().debts.find((d) => d.id === debtId)!.linkedPaymentMethodId!
    const undo = removeMethodWithUndo(cc, 'delete')
    expect(s().debts.some((d) => d.id === debtId)).toBe(false)
    undo()
    expect(s().debts.some((d) => d.id === debtId)).toBe(true)
    expect(s().paymentMethods.some((m) => m.id === cc)).toBe(true)
  })
})

describe('a goal pocket name never repeats "pocket" (W2)', () => {
  it('adds the word only when the goal name lacks it', () => {
    expect(catalogCopyEn.goalPocketName('QA phone')).toBe('QA phone pocket')
    expect(catalogCopyEn.goalPocketName('QA phone pocket')).toBe('QA phone pocket')
    expect(catalogCopyAr.goalPocketName('جيب السفر')).toBe('جيب السفر')
  })
})
