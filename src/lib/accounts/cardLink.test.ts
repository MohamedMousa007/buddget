import { beforeEach, describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { paymentMethodToRow } from '@/lib/supabase/remote/mappers/paymentMethodMapper'
import { linkableAccounts, linksToAccount, matchLinkedAccount, relinkNeedsConfirm, savedParentId } from './cardLink'

const pm = (o: Partial<PaymentMethod>): PaymentMethod => ({ id: 'x', name: 'X', type: 'bank_account', currency: 'EGP', isDefault: false, ...o }) as PaymentMethod

const hsbcEgp = pm({ id: 'hsbc-egp', name: 'HSBC', currency: 'EGP' })
const hsbcUsd = pm({ id: 'hsbc-usd', name: 'HSBC', currency: 'USD' as PaymentMethod['currency'] })
const nbe = pm({ id: 'nbe', name: 'NBE' })
const accounts = [hsbcEgp, hsbcUsd, nbe]

describe('which cards link to an account (D1)', () => {
  it('debit and credit only', () => {
    expect(linksToAccount('debit_card')).toBe(true)
    expect(linksToAccount('credit_card')).toBe(true)
    for (const t of ['prepaid_card', 'wallet', 'bnpl', 'other', 'bank_account', 'cash'] as const) expect(linksToAccount(t)).toBe(false)
  })
  it('a non-linking type never saves a parent', () => {
    expect(savedParentId('prepaid_card', 'nbe')).toBeUndefined()
    expect(savedParentId('debit_card', 'nbe')).toBe('nbe')
    expect(savedParentId('credit_card', undefined)).toBeUndefined()
  })
  it('offers open banks and wallets, never cards, closed or provisional rows', () => {
    const rows = [...accounts, pm({ id: 'w', type: 'wallet', name: 'Vodafone Cash' }), pm({ id: 'c', type: 'debit_card', parentId: 'nbe' }),
      pm({ id: 'closed', closedAt: '2026-01-01' }), pm({ id: 'prov', provisional: true }), pm({ id: 'cash', type: 'cash' })]
    expect(linkableAccounts(rows).map((m) => m.id)).toEqual(['hsbc-egp', 'hsbc-usd', 'nbe', 'w'])
  })
})

describe('a provider change re-checks the link (D3)', () => {
  it('one account of that provider: links to it', () => {
    expect(matchLinkedAccount('NBE', 'EGP', accounts)).toBe('nbe')
  })
  it('two accounts of that provider: the one in the card currency', () => {
    expect(matchLinkedAccount('HSBC', 'USD', accounts)).toBe('hsbc-usd')
  })
  it('two accounts and neither in the card currency: none', () => {
    expect(matchLinkedAccount('HSBC', 'SAR', accounts)).toBeUndefined()
  })
  it('no account of that provider: none', () => {
    expect(matchLinkedAccount('CIB', 'EGP', accounts)).toBeUndefined()
    expect(matchLinkedAccount('', 'EGP', accounts)).toBeUndefined()
  })
})

describe('relinking a debit card with history asks first (D5)', () => {
  const debit = pm({ id: 'card', type: 'debit_card', parentId: 'nbe' })
  it('debit, link changes, has history', () => expect(relinkNeedsConfirm(debit, 'hsbc-egp', true)).toBe(true))
  it('unlinking also counts', () => expect(relinkNeedsConfirm(debit, undefined, true)).toBe(true))
  it('no history, same link, a credit card or a new card: no confirm', () => {
    expect(relinkNeedsConfirm(debit, 'hsbc-egp', false)).toBe(false)
    expect(relinkNeedsConfirm(debit, 'nbe', true)).toBe(false)
    expect(relinkNeedsConfirm({ ...debit, type: 'credit_card' }, 'hsbc-egp', true)).toBe(false)
    expect(relinkNeedsConfirm(null, 'hsbc-egp', true)).toBe(false)
  })
})

describe('store', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      paymentMethods: [nbe, pm({ id: 'card', type: 'debit_card', name: 'NBE ••1234', last4: '1234' })],
      debts: [], expenses: [], incomeEvents: [], debtPayments: [], savingsTransactions: [], accountAdjustments: [],
    })
  })
  it('adding a card that already exists standalone links the existing one (D6)', () => {
    const id = useFinanceStore.getState().addPaymentMethod({ name: 'NBE ••1234', type: 'debit_card', currency: 'EGP', last4: '1234', isDefault: false, parentId: 'nbe' })
    expect(id).toBe('card')
    const s = useFinanceStore.getState()
    expect(s.paymentMethods).toHaveLength(2)
    expect(s.paymentMethods.find((m) => m.id === 'card')!.parentId).toBe('nbe')
  })
  it('a used standalone debit card is not moved by the reuse path; the edit sheet asks first (D5 over D6)', () => {
    useFinanceStore.setState({ expenses: [{ id: 'e1', paymentMethodId: 'card' } as never] })
    const id = useFinanceStore.getState().addPaymentMethod({ name: 'NBE ••1234', type: 'debit_card', currency: 'EGP', last4: '1234', isDefault: false, parentId: 'nbe' })
    expect(id).toBe('card')
    expect(useFinanceStore.getState().paymentMethods.find((m) => m.id === 'card')!.parentId).toBeUndefined()
  })
  it('the reuse path never moves a card that already has another parent', () => {
    useFinanceStore.getState().updatePaymentMethod('card', { parentId: 'nbe' })
    useFinanceStore.getState().addPaymentMethod({ name: 'NBE ••1234', type: 'debit_card', currency: 'EGP', last4: '1234', isDefault: false, parentId: 'other' })
    expect(useFinanceStore.getState().paymentMethods.find((m) => m.id === 'card')!.parentId).toBe('nbe')
  })
  it('an edit that links then unlinks writes parent_id, and unlinking keeps SMS tracking on (D7)', () => {
    useFinanceStore.getState().updatePaymentMethod('card', { parentId: savedParentId('debit_card', 'nbe') })
    let card = useFinanceStore.getState().paymentMethods.find((m) => m.id === 'card')!
    expect(paymentMethodToRow(card, 'u').parent_id).toBe('nbe')
    useFinanceStore.getState().updatePaymentMethod('card', { parentId: savedParentId('debit_card', undefined) })
    card = useFinanceStore.getState().paymentMethods.find((m) => m.id === 'card')!
    const row = paymentMethodToRow(card, 'u')
    expect(row.parent_id).toBeNull()
    expect(row.track_sms).toBe(true)
  })
})
