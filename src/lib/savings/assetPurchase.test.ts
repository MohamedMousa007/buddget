import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances } from '@/lib/accounts/balance'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { ledgerOf } from '@/lib/savings/pocketHome'
import { applyAssetPurchase, assetFundingId, assetPayCurrency, holdingFundedBy, planAssetPurchase, type AssetBuy } from '@/lib/savings/assetPurchase'
import { deleteHoldingWithUndo } from '@/lib/savings/pocketUndo'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import { localTodayISO } from '@/lib/utils/localDate'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const PRICE_21K = 4000
const lookup: PriceLookup = (symbol, currency) => (symbol === 'XAU_21K' && currency === 'EGP' ? { price: PRICE_21K, asOf: '2026-11-26T00:00:00Z', confidence: null } : null)

const bank = { id: 'bank', name: 'CIB', type: 'bank_account', currency: 'EGP', createdAt: '2026-01-01', openingBalance: 100_000, openingAt: '2026-01-01T08:00:00.000Z' } as PaymentMethod
const pocket = { id: 'trip', name: 'Trip', type: 'bank', category: 'savings', currency: 'EGP', currentBalance: 30_000, createdAt: '2026-01-01' } as SavingsAccount

const bankBalance = () => computeBalances(ledgerOf(S())).get('bank')!.balance
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    savingsAccounts: s.savingsAccounts, investmentHoldings: s.investmentHoldings, debts: [], settings: s.settings,
    exchangeRates: {}, goldPricePerGram: PRICE_21K, goldPriceAvailable: true, lookup, debtRemaining: 0,
    accountsBasis: bankBalance(), heldInPocketIds: new Set(),
  }).netWorth
}
const gold = (grams: number): AssetBuy['holding'] => ({ assetType: 'gold', name: '21k gold', karat: 21, quantity: grams, goldUnit: 'grams', currency: 'EGP' })
const buy = (over: Partial<AssetBuy> & { grams?: number }): AssetBuy => {
  const { grams = 10, ...rest } = over
  return {
    source: { kind: 'account', id: 'bank' }, paid: 10 * PRICE_21K, currency: 'EGP', priced: true,
    holding: gold(grams), units: grams, date: localTodayISO(), occurredAt: new Date().toISOString(),
    ...rest,
  }
}

beforeEach(() => {
  useFinanceStore.setState({
    settings: { ...S().settings, baseCurrency: 'EGP' },
    paymentMethods: [bank], savingsAccounts: [{ ...pocket }], expenses: [], incomeEvents: [], debtPayments: [], debts: [],
    savingsTransactions: [], accountAdjustments: [], investmentHoldings: [], goals: [], exchangeRates: {},
    goldPricePerGram: PRICE_21K, goldPriceAvailable: true,
  })
})

describe('applyAssetPurchase', () => {
  it('from an account: the account drops by what was paid, the grams are added, net worth is unchanged', () => {
    const before = netWorth()
    expect(applyAssetPurchase(S(), buy({}))).toBeNull()
    expect(bankBalance()).toBe(60_000)
    expect(S().investmentHoldings).toHaveLength(1)
    expect(S().investmentHoldings[0]).toMatchObject({ assetType: 'gold', karat: 21, quantity: 10, unitCost: PRICE_21K, costBasisCurrency: 'EGP' })
    expect(S().expenses[0]).toMatchObject({ category: 'Savings', amount: 40_000, paymentMethodId: 'bank' })
    expect(netWorth()).toBeCloseTo(before, 6)
  })

  it('from a pocket: the pocket gives up what was paid, net worth is unchanged, no income is booked', () => {
    const before = netWorth()
    expect(applyAssetPurchase(S(), buy({ source: { kind: 'pocket', id: 'trip' }, paid: 20_000, grams: 5 }))).toBeNull()
    expect(S().savingsAccounts[0].currentBalance).toBe(10_000)
    expect(S().savingsTransactions[0]).toMatchObject({ type: 'withdrawal', amount: 20_000 })
    expect(S().incomeEvents).toHaveLength(0)
    expect(netWorth()).toBeCloseTo(before, 6)
  })

  it('from outside: only the grams are added, so net worth rises by their value', () => {
    const before = netWorth()
    expect(applyAssetPurchase(S(), buy({ source: { kind: 'outside' }, paid: 0 }))).toBeNull()
    expect(S().expenses).toHaveLength(0)
    expect(S().savingsTransactions).toHaveLength(0)
    expect(netWorth()).toBeCloseTo(before + 10 * PRICE_21K, 6)
  })

  it('keeps the picked day and time on the money row and the holding', () => {
    const occurredAt = new Date(2026, 10, 20, 18, 30).toISOString()
    applyAssetPurchase(S(), buy({ date: '2026-11-20', occurredAt }))
    expect(S().expenses[0]).toMatchObject({ date: '2026-11-20', occurredAt })
    expect(S().investmentHoldings[0].purchaseDate).toBe('2026-11-20')
  })

  it.each([
    ['more than the account has free', buy({ paid: 150_000 }), 'over_available'],
    ['more than the pocket holds', buy({ source: { kind: 'pocket', id: 'trip' }, paid: 40_000 }), 'over_pocket'],
    ['no live gold price', buy({ priced: false }), 'no_price'],
    ['no account picked', buy({ source: { kind: 'account' } }), 'no_account'],
    ['no amount paid', buy({ paid: 0 }), 'no_paid'],
    ['no rate into the account', buy({ currency: 'BTC' }), 'no_rate'],
  ] as const)('refuses %s and writes nothing', (_, input, reason) => {
    expect(applyAssetPurchase(S(), input)).toBe(reason)
    expect(S().expenses).toHaveLength(0)
    expect(S().savingsTransactions).toHaveLength(0)
    expect(S().investmentHoldings).toHaveLength(0)
  })

  it('an outside buy needs no price or amount', () => {
    expect(planAssetPurchase(S(), { source: { kind: 'outside' }, paid: 0, currency: 'EGP', priced: false })).toEqual({ action: 'holding' })
  })
})

describe('assetPayCurrency', () => {
  it('is the account\'s or money pocket\'s currency, and the base currency for a gold pocket or outside', () => {
    useFinanceStore.setState({ paymentMethods: [{ ...bank, currency: 'USD' }], savingsAccounts: [{ ...pocket, currency: 'XAU' }] })
    expect(assetPayCurrency(S(), { kind: 'account', id: 'bank' })).toBe('USD')
    expect(assetPayCurrency(S(), { kind: 'pocket', id: 'trip' })).toBe('EGP')
    expect(assetPayCurrency(S(), { kind: 'outside' })).toBe('EGP')
  })
})

describe('assetPayCurrency fallback', () => {
  it('uses the given fallback for an outside buy (a stock paid in USD)', () => {
    expect(assetPayCurrency(S(), { kind: 'outside' }, 'USD')).toBe('USD')
  })
})

describe('a crypto buy uses the same path', () => {
  it('from an account: the money row is booked and the coins added', () => {
    expect(applyAssetPurchase(S(), buy({ holding: { assetType: 'crypto', name: 'BTC', symbol: 'BTC', quantity: 0.5, currency: 'EGP' }, units: 0.5, paid: 20_000 }))).toBeNull()
    expect(bankBalance()).toBe(80_000)
    expect(S().investmentHoldings[0]).toMatchObject({ assetType: 'crypto', quantity: 0.5, unitCost: 40_000 })
  })
})

describe('the holding and its money row are deleted together', () => {
  it('links the money row to the holding by a derived id', () => {
    applyAssetPurchase(S(), buy({}))
    const h = S().investmentHoldings[0]
    expect(S().expenses[0].id).toBe(assetFundingId(h.id))
    expect(holdingFundedBy(S().investmentHoldings, S().expenses[0].id)?.id).toBe(h.id)
  })

  it('deleting a holding bought from an account removes its expense; Undo brings both back', () => {
    applyAssetPurchase(S(), buy({}))
    const undo = deleteHoldingWithUndo(S().investmentHoldings[0].id)
    expect(S().investmentHoldings).toHaveLength(0)
    expect(S().expenses).toHaveLength(0)
    expect(bankBalance()).toBe(100_000)
    undo()
    expect(S().investmentHoldings).toHaveLength(1)
    expect(S().expenses).toHaveLength(1)
    expect(bankBalance()).toBe(60_000)
  })

  it('deleting a holding bought from a pocket returns the money; Undo takes it out again', () => {
    applyAssetPurchase(S(), buy({ source: { kind: 'pocket', id: 'trip' }, paid: 20_000, grams: 5 }))
    const undo = deleteHoldingWithUndo(S().investmentHoldings[0].id)
    expect(S().savingsTransactions).toHaveLength(0)
    expect(S().savingsAccounts[0].currentBalance).toBe(30_000)
    undo()
    expect(S().savingsTransactions).toHaveLength(1)
    expect(S().savingsAccounts[0].currentBalance).toBe(10_000)
    expect(S().investmentHoldings).toHaveLength(1)
  })

  it('Undo restores nothing when the pocket no longer holds the money', () => {
    applyAssetPurchase(S(), buy({ source: { kind: 'pocket', id: 'trip' }, paid: 20_000, grams: 5 }))
    const undo = deleteHoldingWithUndo(S().investmentHoldings[0].id)
    useFinanceStore.setState({ savingsAccounts: [{ ...pocket, currentBalance: 5_000 }] })
    undo()
    expect(S().investmentHoldings).toHaveLength(0)
    expect(S().savingsTransactions).toHaveLength(0)
  })

  it('an outside buy has no money row, so only the holding goes', () => {
    applyAssetPurchase(S(), buy({ source: { kind: 'outside' }, paid: 0 }))
    deleteHoldingWithUndo(S().investmentHoldings[0].id)
    expect(S().investmentHoldings).toHaveLength(0)
  })
})
