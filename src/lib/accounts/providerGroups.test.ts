import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/lib/store/types'
import { groupByProvider } from './providerGroups'
import { standaloneCardsOf, type AccountView } from './useAccounts'

const pm = (id: string, name: string, type: PaymentMethod['type'], over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name, type, currency: 'EGP', isDefault: false, createdAt: '2026-01-01', ...over }) as PaymentMethod
const view = (method: PaymentMethod, balance: number | null, cards: PaymentMethod[] = [], held = 0): AccountView => ({
  method, cards,
  balance: balance === null ? null : { id: method.id, currency: String(method.currency), balance, held, cardHold: 0, free: Math.max(0, balance - held), approx: false },
})
const convert = (a: number, from: string, to: string) => (from === to ? a : from === 'USD' && to === 'EGP' ? a * 50 : null)

/** The model exactly as useAccounts builds it: parentless open accounts, and the rest through standaloneCardsOf. */
function model(views: AccountView[], loose: PaymentMethod[] = []) {
  const ids = new Set(views.map((v) => v.method.id))
  return { accounts: views, standaloneCards: standaloneCardsOf(loose, ids) }
}

describe('groupByProvider', () => {
  it('groups aliases of one provider (NBE and National Bank of Egypt) under the catalogue name', () => {
    const r = groupByProvider(model([view(pm('a', 'NBE', 'bank_account'), 1000), view(pm('b', 'National Bank of Egypt', 'bank_account'), 500)]), 'EGP', convert)
    expect(r.banks).toHaveLength(1)
    expect(r.banks[0]).toMatchObject({ key: 'nbe', brandKey: 'nbe', name: 'NBE', section: 'bank', totalInBase: 1500, accountCount: 2, cardCount: 0 })
  })

  it('counts a parentless prepaid card once: in the total and as one face, never again as a card', () => {
    const prepaid = pm('p', 'NBE', 'prepaid_card', { label: 'Meeza prepaid' })
    const r = groupByProvider(model([view(pm('a', 'NBE', 'bank_account'), 1000), view(prepaid, 2000)]), 'EGP', convert)
    const g = r.banks[0]
    expect(g.totalInBase).toBe(3000)
    expect(g.cards).toEqual([{ method: prepaid, parentAccountId: null, isAccount: true }])
    expect(g.accountCount).toBe(1)
    expect(g.cardCount).toBe(1)
    expect(r.otherCards).toEqual([])
  })

  it('keeps credit owed out of the total; cards follow their parent in order with its id', () => {
    const debit = pm('d', 'CIB ••4821', 'debit_card', { parentId: 'a' })
    const credit = pm('c', 'CIB ••6120', 'credit_card', { parentId: 'a' })
    const r = groupByProvider(model([view(pm('a', 'CIB', 'bank_account'), 10000, [debit, credit], 2500)]), 'EGP', convert)
    const g = r.banks[0]
    expect(g.totalInBase).toBe(10000)
    expect(g.heldInBase).toBe(2500)
    expect(g.cards.map((c) => [c.method.id, c.parentAccountId])).toEqual([['d', 'a'], ['c', 'a']])
  })

  it('a card of a closed or missing parent goes to its own provider, which can be card-only', () => {
    const closed = pm('x', 'CIB', 'bank_account', { closedAt: '2026-02-01' })
    const orphan = pm('d', 'CIB ••4821', 'debit_card', { parentId: 'x' })
    const lost = pm('q', 'QNB ••1111', 'credit_card', { parentId: 'gone' })
    const r = groupByProvider(model([view(pm('a', 'CIB', 'bank_account'), 100)], [closed, orphan, lost]), 'EGP', convert)
    const cib = r.banks.find((g) => g.key === 'cib')!
    expect(cib.cards).toEqual([{ method: orphan, parentAccountId: null, isAccount: false }])
    const qnb = r.banks.find((g) => g.key === 'qnb')!
    expect(qnb).toMatchObject({ accountCount: 0, cardCount: 1, totalInBase: 0 })
  })

  it('sends unidentifiable and pay-later cards to Other, but a known non-catalogue provider keeps its card', () => {
    const store = pm('s', 'Corner Shop Card', 'other')
    const valu = pm('v', 'valU', 'bnpl')
    const local = pm('l', 'Zeta Credit Union ••4321', 'debit_card', { last4: '4321' })
    const r = groupByProvider(model([view(pm('a', 'Zeta Credit Union', 'bank_account'), 50)], [store, valu, local]), 'EGP', convert)
    expect(r.otherCards.map((c) => c.method.id)).toEqual(['s', 'v'])
    expect(r.banks[0]).toMatchObject({ key: 'name:zetacreditunion', brandKey: null, name: 'Zeta Credit Union' })
    expect(r.banks[0].cards.map((c) => c.method.id)).toEqual(['l'])
  })

  it('leaves a provisional method out of the cards entirely', () => {
    const provisional = pm('p', 'CIB ••1234', 'debit_card', { provisional: true })
    const r = groupByProvider(model([view(pm('a', 'CIB', 'bank_account'), 100)], [provisional]), 'EGP', convert)
    expect(r.banks[0].cards).toEqual([])
    expect(r.otherCards).toEqual([])
  })

  it('splits sections: a wallet account makes a wallet group, card-only groups follow the catalogue type, Cash is no group', () => {
    const cash = view(pm('cash1', 'Cash', 'cash', { openingBalance: 1, openingAt: '2026-01-01' }), 1)
    const payoneerCard = pm('pc', 'Payoneer ••3', 'debit_card')
    const r = groupByProvider(model([view(pm('w', 'Vodafone Cash', 'wallet'), 300), view(pm('a', 'CIB', 'bank_account'), 100), cash], [payoneerCard]), 'EGP', convert)
    expect(r.banks.map((g) => g.key)).toEqual(['cib'])
    expect(r.wallets.map((g) => g.key)).toEqual(['vodafone', 'payoneer'])
    expect(r.cash).toEqual([cash])
  })

  it('converts to base and marks the total approximate; an unpriced account is left out', () => {
    const r = groupByProvider(model([
      view(pm('e', 'HSBC', 'bank_account'), 1000), view(pm('u', 'HSBC', 'bank_account', { currency: 'USD' }), 10),
      view(pm('g', 'HSBC', 'bank_account', { currency: 'GBP' }), 99),
    ]), 'EGP', convert)
    expect(r.banks[0].totalInBase).toBe(1500)
    expect(r.banks[0].approx).toBe(true)
  })
})
