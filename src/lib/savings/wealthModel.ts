import type { Currency, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { valueInvestmentHolding, type PriceLookup } from '@/lib/savings/holdingValuation'

export type CatKey =
  | 'bank' | 'vault' | 'cash' | 'certificate' | 'wallet'
  | 'gold' | 'crypto' | 'stock' | 'property'

/** How a figure is arrived at — drives the hero split when anything is held beyond pockets. */
export type Pricing = 'balance' | 'market' | 'self'

export interface WealthRowVM {
  id: string
  source: 'account' | 'holding'
  cat: CatKey
  pricing: Pricing
  title: string
  /** Base-currency value; null when it could not be priced (never counted in totals). */
  amount: number | null
  asOf?: string
  /** Gold/crypto/stock: quantity and unit price for "40 g × 5,990". */
  quantity?: number
  unitPrice?: number | null
  account?: SavingsAccount
  holding?: InvestmentHolding
}

export interface WealthInput {
  accounts: SavingsAccount[]
  holdings: InvestmentHolding[]
  lookup: PriceLookup
  baseCurrency: Currency
  rates: Record<string, number>
  goldPricePerGram: number
  goldOk: boolean
}

export interface WealthModel {
  rows: WealthRowVM[]
  total: number
  byPricing: Record<Pricing, number>
  /** Pockets-only users: value per kind for the hero split. */
  byKind: { bank: number; vault: number; cash: number; other: number }
  anyUnpriced: boolean
  /** Return since first purchase on market-priced holdings with a cost basis; null when unknown. */
  investReturnPct: number | null
  categories: { key: CatKey; count: number }[]
}

export function catForAccount(a: SavingsAccount): CatKey {
  if (a.category === 'investment') {
    if (a.type === 'gold') return 'gold'
    if (a.type === 'crypto' || a.type === 'stablecoin') return 'crypto'
    if (a.type === 'stocks') return 'stock'
    if (a.type === 'real_estate') return 'property'
  }
  if (a.type === 'vault') return 'vault'
  if (a.type === 'cash') return 'cash'
  if (a.type === 'bank') return a.maturityDate ? 'certificate' : 'bank'
  return 'wallet'
}

const HOLDING_CAT: Record<InvestmentHolding['assetType'], CatKey> = {
  gold: 'gold', crypto: 'crypto', stock: 'stock', property: 'property',
}

export function buildWealth(input: WealthInput): WealthModel {
  const { accounts, holdings, lookup, baseCurrency, rates, goldPricePerGram, goldOk } = input
  const rows: WealthRowVM[] = []
  const byPricing: Record<Pricing, number> = { balance: 0, market: 0, self: 0 }
  const byKind = { bank: 0, vault: 0, cash: 0, other: 0 }
  let anyUnpriced = false

  for (const a of accounts) {
    const cat = catForAccount(a)
    const amount = savingsAccountBalanceInBase(a, baseCurrency, rates, goldPricePerGram, goldOk)
    const pricing: Pricing = a.category === 'investment' ? 'market' : 'balance'
    if (amount === null) anyUnpriced = true
    else {
      byPricing[pricing] += amount
      if (pricing === 'balance') {
        byKind[cat === 'bank' || cat === 'certificate' ? 'bank' : cat === 'vault' ? 'vault' : cat === 'cash' ? 'cash' : 'other'] += amount
      }
    }
    rows.push({ id: a.id, source: 'account', cat, pricing, title: a.name, amount, account: a })
  }

  let cost = 0
  let costedValue = 0
  for (const h of holdings) {
    const v = valueInvestmentHolding(h, lookup)
    const amount = v.priced && v.value != null ? convertCurrency(v.value, 'EGP', baseCurrency, rates) : null
    const pricing: Pricing = h.assetType === 'property' ? 'self' : 'market'
    if (amount === null) anyUnpriced = true
    else {
      byPricing[pricing] += amount
      if (pricing === 'market' && h.unitCost != null && h.unitCost > 0) {
        cost += convertCurrency(h.unitCost * h.quantity, h.costBasisCurrency ?? baseCurrency, baseCurrency, rates)
        costedValue += amount
      }
    }
    const unitPrice = v.priced && v.value != null && h.quantity > 0 ? v.value / h.quantity : null
    rows.push({
      id: h.id, source: 'holding', cat: HOLDING_CAT[h.assetType], pricing, title: h.name, amount,
      asOf: v.asOf, quantity: h.quantity, unitPrice, holding: h,
    })
  }

  const counts = new Map<CatKey, number>()
  for (const r of rows) counts.set(r.cat, (counts.get(r.cat) ?? 0) + 1)

  return {
    rows,
    total: byPricing.balance + byPricing.market + byPricing.self,
    byPricing,
    byKind,
    anyUnpriced,
    investReturnPct: cost > 0 ? ((costedValue - cost) / cost) * 100 : null,
    categories: [...counts.entries()].map(([key, count]) => ({ key, count })),
  }
}

export type EmergencyState = 'unset' | 'needsMoney' | 'secured'

/** unset = no essentials to size a month from; secured = cover >= target; otherwise needsMoney. */
export function emergencyState(monthlyEssentials: number, atOrAboveTarget: boolean): EmergencyState {
  if (monthlyEssentials <= 0) return 'unset'
  return atOrAboveTarget ? 'secured' : 'needsMoney'
}

/** Share of this month's income that was saved; null when there is no income to compare to. */
export function savingsRatePct(savedThisMonth: number, incomeThisMonth: number): number | null {
  return incomeThisMonth > 0 ? Math.max(0, Math.round((savedThisMonth / incomeThisMonth) * 100)) : null
}
