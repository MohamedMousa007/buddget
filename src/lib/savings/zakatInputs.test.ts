import { describe, expect, it } from 'vitest'
import { debtDueWithinLunarYear, deriveZakatBase, toZakatInput } from './zakatInputs'
import { computeZakat } from './zakat'

const lookup = (() => null) as never
const run = (over: Record<string, unknown>) =>
  deriveZakatBase({
    savingsAccounts: [], investmentHoldings: [], debts: [], baseCurrency: 'EGP',
    exchangeRates: {}, goldPricePerGram: 6000, goldPriceAvailable: true, lookup, ...over,
  } as never)

const pocket = (over: Record<string, unknown>) =>
  ({ id: 'p', name: 'p', category: 'investment', type: 'gold', currency: 'XAU', currentBalance: 100, ...over })
const debt = (over: Record<string, unknown>) =>
  ({ id: 'd', currency: 'EGP', isGold: false, installmentAmount: 100, direction: 'i_owe', ...over }) as never
const pay = (debtId: string, amountPaid: number, date: string) => ({ id: `${debtId}-${date}`, debtId, amountPaid, date, createdAt: date })
const priced = ((key: string) => (key === 'XAU_24K' ? { price: 6000 } : null)) as never

describe('deriveZakatBase investment pockets', () => {
  it('counts investment-category gold pockets as gold', () => {
    expect(run({ savingsAccounts: [pocket({})] }).goldValue).toBe(600_000)
  })
  it('routes crypto and stock pockets to their lines and skips property', () => {
    const r = run({
      savingsAccounts: [
        pocket({ id: 'c', type: 'crypto', currency: 'EGP', currentBalance: 10 }),
        pocket({ id: 's', type: 'stocks', currency: 'EGP', currentBalance: 20 }),
        pocket({ id: 'r', type: 'real_estate', currency: 'EGP', currentBalance: 999 }),
      ],
    })
    expect([r.cryptoValue, r.stocksValue, r.goldValue, r.cashAndSavings]).toEqual([10, 20, 0, 0])
  })
})

describe('debts due within the lunar year', () => {
  const today = new Date('2026-06-01T12:00:00')
  it('estimates unscheduled debts by how many periods fit in 354 days', () => {
    const r = run({
      today,
      debts: [
        debt({ id: 'a', installmentFrequency: 'weekly' }),
        debt({ id: 'b', installmentFrequency: 'quarterly' }),
        debt({ id: 'c' }),
      ],
    })
    expect(r.debtsDueThisYear).toBe(100 * 51 + 100 * 4 + 100 * 12)
  })
  it('counts only scheduled slots in the next 354 days, plus overdue ones, not the whole remaining balance', () => {
    // 36 monthly slots from 2026-01-01; 2 paid. Due by 2027-05-21: slots Mar 2026 .. May 2027 = 15.
    const d = debt({ debtType: 'installment', startDate: '2026-01-01', installmentCount: 36, installmentFrequency: 'monthly', startingBalance: 3600 })
    const own = [pay('d', 100, '2026-01-01'), pay('d', 100, '2026-02-01')]
    expect(debtDueWithinLunarYear(d, own, today, 3400)).toBe(1500)
    expect(run({ today, debts: [d], debtPayments: own }).debtsDueThisYear).toBe(1500)
  })
  it('caps at what is still owed', () => {
    const d = debt({ startingBalance: 250 })
    expect(run({ today, debts: [d], debtPayments: [] }).debtsDueThisYear).toBe(250)
  })
  it('ignores cleared debts and adds nothing for a debt with no instalment', () => {
    const r = run({ today, debts: [debt({ status: 'cleared' }), debt({ id: 'card', installmentAmount: 0, startingBalance: 9000 })] })
    expect(r.debtsDueThisYear).toBe(0)
  })
})

describe('receivables', () => {
  const owed = (over: Record<string, unknown>) => debt({ direction: 'they_owe', startingBalance: 1000, personName: 'Sara', ...over })
  it('counts money owed to the user by default, net of repayments', () => {
    const r = run({ debts: [owed({})], debtPayments: [pay('d', 300, '2026-01-01')] })
    expect(r.receivables).toBe(700)
    expect(r.debtsDueThisYear).toBe(0)
    expect(r.receivableDebts).toEqual([{ id: 'd', name: 'Sara', value: 700, counted: true }])
  })
  it('leaves out debts marked not likely to be repaid', () => {
    const r = run({ debts: [owed({})], debtPayments: [], config: { doubtfulDebtIds: ['d'] } })
    expect(r.receivables).toBe(0)
    expect(r.receivableDebts[0].counted).toBe(false)
  })
})

describe('gold worn as jewellery', () => {
  const ring = { id: 'g1', assetType: 'gold', name: 'Ring', quantity: 10, karat: 24, currency: 'EGP', createdAt: '2026-01-01' }
  const bar = { id: 'g2', assetType: 'gold', name: 'Bar', quantity: 20, karat: 24, currency: 'EGP', createdAt: '2026-01-01' }
  it('excludes worn holdings and reports their grams', () => {
    const all = run({ lookup: priced, investmentHoldings: [ring, bar] })
    const worn = run({ lookup: priced, investmentHoldings: [ring, bar], config: { jewelleryHoldingIds: ['g1'] } })
    expect(worn.wornGoldGrams).toBe(10)
    expect(worn.goldValue).toBeCloseTo(all.goldValue * (20 / 30), 5)
    expect(worn.goldHoldings.find((h) => h.id === 'g1')?.worn).toBe(true)
  })
})

describe('toZakatInput', () => {
  it('adds trade goods and ignores any old hand-typed figure', () => {
    const base = run({ savingsAccounts: [pocket({ category: 'savings', type: 'other', currency: 'EGP', currentBalance: 50_000 })] })
    const legacy = { nisabBasis: 'silver', holdsForTrading: false, tradeGoodsValue: 10_000, manualAmount: 1, lineOverrides: { cash: 1 } } as never
    const input = toZakatInput({ ...base, silverPerGram: 75 }, legacy)
    expect(input.tradeGoodsValue).toBe(10_000)
    expect(computeZakat(input).zakatable).toBe(60_000)
    expect(computeZakat(input).zakat).toBeCloseTo(1_500, 5)
  })
})
