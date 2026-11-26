import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Currency, Debt, DebtPayment, InvestmentHolding, SavingsAccount, SavingsTransaction, ZakatConfig } from '@/lib/store/types'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import type { ZakatInput } from '@/lib/savings/zakat'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { effectiveNisabBasis } from '@/lib/savings/zakatBasis'
import { LUNAR_YEAR_DAYS } from '@/lib/savings/hawl'
import { instantOf } from '@/lib/accounts/balance'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { calculateDebtRemaining, goldGramsToMoney } from '@/lib/utils/calculations'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { debtIsGold } from '@/lib/debt/debtGold'
import { addByFrequency, installmentPaymentsCompleted } from '@/lib/debts/installmentSchedule'

const PERIOD_DAYS = { weekly: 7, monthly: 365.25 / 12, quarterly: 365.25 / 4, annually: 365.25 } as const

export interface ZakatGoldHolding {
  id: string
  name: string
  grams: number
  value: number
  worn: boolean
}

export interface ZakatReceivable {
  id: string
  name: string
  value: number
  counted: boolean
}

/** The live "what counts" figures for zakat, in base currency. */
export interface ZakatBase {
  cashAndSavings: number
  /** Gold that counts: worn jewellery is already left out. */
  goldValue: number
  cryptoValue: number
  stocksValue: number
  /** Money owed to the user on debts likely to be repaid. */
  receivables: number
  debtsDueThisYear: number
  gold24kSellPerGram: number
  silverPerGram: number
  goldHoldings: ZakatGoldHolding[]
  wornGoldGrams: number
  receivableDebts: ZakatReceivable[]
  /** True when some balance or debt had no FX path and was left out, so the figures are a lower bound. */
  incomplete: boolean
  /** Only with `asOf`: items with no history before that instant, taken at their current value. */
  noHistoryCount: number
}

/** A tracked bank/cash account's balance in its own currency (excluded accounts are filtered out by the caller). */
export interface ZakatTrackedAccount {
  balance: number
  currency: string
  /** The balance is today's, because the account had no known balance at the asked instant. */
  noHistory?: boolean
}

type DebtFrequency = NonNullable<Debt['installmentFrequency']>

/**
 * Debt units (money, or grams on a gold debt) falling due within one lunar year of `today`, overdue slots included,
 * capped at what is still owed. A scheduled plan counts its real due dates; a debt with only an amount and a frequency
 * counts how many periods fit in the year. A debt with no instalment amount (a card, an open loan) adds nothing.
 */
export function debtDueWithinLunarYear(d: Debt, own: readonly DebtPayment[], today: Date, remaining: number): number {
  const per = Number(d.installmentAmount ?? 0) || 0
  if (per <= 0) return 0
  const freq: DebtFrequency = d.installmentFrequency ?? 'monthly'
  if (d.startDate && d.installmentCount) {
    const paid = own.reduce((s, p) => s + p.amountPaid, 0)
    const completed = d.debtType === 'installment'
      ? installmentPaymentsCompleted(d, own)
      : Math.min(d.installmentCount, Math.floor((paid + 0.005) / per))
    const start = parseISO(d.startDate)
    let slots = 0
    for (let k = completed; k < d.installmentCount; k++) {
      if (differenceInCalendarDays(addByFrequency(start, freq, k), today) > LUNAR_YEAR_DAYS) break
      slots++
    }
    return Math.min(slots * per, remaining)
  }
  return Math.min(per * Math.round(LUNAR_YEAR_DAYS / PERIOD_DAYS[freq]), remaining)
}

const debtStartedBy = (d: Debt, at: number) => {
  const from = d.startDate ?? d.principalAt ?? d.createdAt
  return !from || instantOf(undefined, from) <= at
}

const debtOpenAt = (d: Debt, at: number | undefined) => {
  if (at === undefined) return d.status !== 'cleared'
  if (!debtStartedBy(d, at)) return false
  return d.status !== 'cleared' || (!!d.clearedAt && instantOf(undefined, d.clearedAt) > at)
}

export function deriveZakatBase(params: {
  savingsAccounts: SavingsAccount[]
  investmentHoldings: InvestmentHolding[]
  debts: Debt[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  lookup: PriceLookup
  /** Tracked accounts hold real cash that pockets alone miss; absent when the user tracks none. */
  trackedAccounts?: readonly ZakatTrackedAccount[]
  /** Pockets whose money sits inside a tracked account (already counted in its balance). */
  heldInPocketIds?: ReadonlySet<string>
  /** With payments, a debt's deduction is capped at what is still owed and receivables use what is left. */
  debtPayments?: readonly DebtPayment[]
  /** Jewellery and doubtful-receivable choices. */
  config?: Pick<ZakatConfig, 'jewelleryHoldingIds' | 'doubtfulDebtIds'> | null
  /** "Today" for the debts-due window (default now). */
  today?: Date
  /**
   * Rebuild the figures as they stood at this instant (ms): pockets roll back through their transactions, holdings
   * bought later and debts opened later are left out, debts use payments made by then. Prices stay today's.
   */
  asOf?: number
  /** Needed with `asOf`, to roll pockets back. */
  savingsTransactions?: readonly SavingsTransaction[]
}): ZakatBase {
  const { savingsAccounts, investmentHoldings, debts, baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, lookup, trackedAccounts, heldInPocketIds, debtPayments, config, asOf } = params
  const today = params.today ?? (asOf !== undefined ? new Date(asOf) : new Date())
  const goldOk = goldPriceAvailable !== false
  const worn = new Set(config?.jewelleryHoldingIds ?? [])
  const doubtful = new Set(config?.doubtfulDebtIds ?? [])
  let incomplete = false
  let noHistoryCount = 0

  let cashAndSavings = 0
  let goldValue = 0
  let cryptoValue = 0
  let stocksValue = 0

  for (const a of trackedAccounts ?? []) {
    if (a.noHistory) noHistoryCount++
    const v = tryConvertCurrency(a.balance, a.currency, baseCurrency, exchangeRates)
    if (v === null) incomplete = true
    else cashAndSavings += v
  }

  const laterNet = new Map<string, number>()
  const hasTx = new Set<string>()
  // A row in another unit than its pocket cannot be rolled back 1:1, so that pocket is taken at today's value.
  const mixed = new Set<string>()
  if (asOf !== undefined) {
    const unitOf = new Map(savingsAccounts.map((a) => [a.id, a.currency]))
    for (const t of params.savingsTransactions ?? []) {
      hasTx.add(t.accountId)
      if (t.currency && t.currency !== unitOf.get(t.accountId)) mixed.add(t.accountId)
      if (instantOf(t.occurredAt, t.date) <= asOf) continue
      laterNet.set(t.accountId, (laterNet.get(t.accountId) ?? 0) + (t.type === 'deposit' ? t.amount : -t.amount))
    }
  }

  // Pockets: liquid ones are cash; investment pockets go to their asset line (property is never zakatable).
  for (const pocket of savingsAccounts) {
    if (heldInPocketIds?.has(pocket.id)) continue
    let a = pocket
    if (asOf !== undefined) {
      if (!hasTx.has(pocket.id) || mixed.has(pocket.id)) noHistoryCount++
      else a = { ...pocket, currentBalance: Math.max(0, pocket.currentBalance - (laterNet.get(pocket.id) ?? 0)) }
    }
    const v = savingsAccountBalanceInBase(a, baseCurrency, exchangeRates, goldPricePerGram, goldOk)
    if (v === null) {
      incomplete = true
      continue
    }
    if (a.category === 'savings') cashAndSavings += v
    else if (a.type === 'gold') goldValue += v
    else if (a.type === 'crypto' || a.type === 'stablecoin') cryptoValue += v
    else if (a.type === 'stocks') stocksValue += v
    else if (a.type !== 'real_estate') cashAndSavings += v
  }

  const goldHoldings: ZakatGoldHolding[] = []
  let wornGoldGrams = 0
  for (const h of investmentHoldings) {
    if (asOf !== undefined) {
      if (!h.purchaseDate) noHistoryCount++
      else if (instantOf(undefined, h.purchaseDate) > asOf) continue
    }
    const v = valueInvestmentHolding(h, lookup)
    if (!v.priced || v.value == null) continue // unpriceable → excluded
    const inBase = tryConvertCurrency(v.value, 'EGP', baseCurrency, exchangeRates)
    if (inBase === null) {
      incomplete = true
      continue
    }
    if (h.assetType === 'gold') {
      const isWorn = worn.has(h.id)
      goldHoldings.push({ id: h.id, name: h.name, grams: h.quantity, value: inBase, worn: isWorn })
      if (isWorn) wornGoldGrams += h.quantity
      else goldValue += inBase
    } else if (h.assetType === 'crypto') cryptoValue += inBase
    else if (h.assetType === 'stock') stocksValue += inBase
    // property is never zakatable
  }

  const paymentsOf = new Map<string, DebtPayment[]>()
  for (const p of debtPayments ?? []) {
    if (asOf !== undefined && instantOf(p.occurredAt, p.date) > asOf) continue
    const list = paymentsOf.get(p.debtId)
    if (list) list.push(p)
    else paymentsOf.set(p.debtId, [p])
  }
  const toBase = (d: Debt, units: number): number | null => {
    if (debtIsGold(d)) return goldOk ? goldGramsToMoney(units, goldPricePerGram, d.goldKarat ?? 24) : null
    return tryConvertCurrency(units, (d.currency as Currency) ?? baseCurrency, baseCurrency, exchangeRates)
  }

  let debtsDueThisYear = 0
  let receivables = 0
  const receivableDebts: ZakatReceivable[] = []
  for (const d of debts) {
    if (!debtOpenAt(d, asOf)) continue
    const own = paymentsOf.get(d.id) ?? []
    const remaining = debtPayments ? calculateDebtRemaining(d, own) : Infinity
    if (isOwedToUser(d)) {
      const owed = Number.isFinite(remaining) ? remaining : Math.max(0, d.startingBalance ?? 0)
      if (owed <= 0) continue
      const v = toBase(d, owed)
      if (v === null) {
        incomplete = true
        continue
      }
      const counted = !doubtful.has(d.id)
      receivableDebts.push({ id: d.id, name: d.personName || d.person || d.name, value: v, counted })
      if (counted) receivables += v
      continue
    }
    const units = debtDueWithinLunarYear(d, own, today, remaining)
    if (units <= 0) continue
    const v = toBase(d, units)
    if (v === null) incomplete = true
    else debtsDueThisYear += v
  }

  // Gold 24k sell price per gram in base; silver estimated from the gold:silver ratio (~85:1) when
  // no silver feed exists — the nisab is explicitly an estimate and the user can switch to gold nisab.
  const gold24kSellPerGram = lookup('XAU_24K', baseCurrency)?.price ?? (goldOk ? goldPricePerGram : 0)
  const silverPerGram = gold24kSellPerGram > 0 ? gold24kSellPerGram / 85 : 0

  return {
    cashAndSavings, goldValue, cryptoValue, stocksValue, receivables, debtsDueThisYear, gold24kSellPerGram, silverPerGram,
    goldHoldings, wornGoldGrams, receivableDebts, incomplete, noHistoryCount,
  }
}

/** The one place a zakat config meets the live figures: the Wealth page and the sheet both compute through it. */
export function toZakatInput(base: ZakatBase, cfg: ZakatConfig | null | undefined): ZakatInput {
  const trade = cfg?.tradeGoodsValue
  return {
    cashAndSavings: base.cashAndSavings,
    goldValue: base.goldValue,
    cryptoValue: base.cryptoValue,
    stocksValue: base.stocksValue,
    receivables: base.receivables,
    tradeGoodsValue: typeof trade === 'number' && Number.isFinite(trade) ? Math.max(0, trade) : 0,
    holdsForTrading: cfg?.holdsForTrading ?? false,
    debtsDueThisYear: base.debtsDueThisYear,
    nisabBasis: effectiveNisabBasis(cfg),
    gold24kSellPerGram: base.gold24kSellPerGram,
    silverPerGram: base.silverPerGram,
  }
}
