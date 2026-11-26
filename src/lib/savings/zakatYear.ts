import { addDays, format, parseISO } from 'date-fns'
import { balancesOverTime, computeBalances, type AccountBalance, type BalancesAt, type LedgerInput } from '@/lib/accounts/balance'
import type { Currency, Debt, DebtPayment, InvestmentHolding, ZakatConfig } from '@/lib/store/types'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import { LUNAR_YEAR_DAYS } from '@/lib/savings/hawl'
import { computeZakat, type ZakatResult } from '@/lib/savings/zakat'
import { deriveZakatBase, toZakatInput, type ZakatBase } from '@/lib/savings/zakatInputs'
import { zakatAccountsFromLedger } from '@/lib/savings/zakatAccounts'

/**
 * The one-year rule (hawl), Hanafi reading: one year for the whole pool. Zakat is due on the zakat date only when the
 * zakatable wealth was at or above nisab both at the year start (one lunar year earlier) and on the zakat date; dips in
 * between do not matter, and money that arrived during the year counts. Past wealth is rebuilt from the store's own
 * history at today's prices.
 */

/** Everything the zakat figures are built from; all already in the store. */
export interface ZakatSources {
  ledger: LedgerInput
  investmentHoldings: InvestmentHolding[]
  /** The debts and payments zakat counts (excluded-account debts already left out). */
  debts: Debt[]
  debtPayments: DebtPayment[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  lookup: PriceLookup
}

/** Last instant of a local day, so everything dated that day is in. */
export const endOfDayMs = (day: string): number => new Date(`${day.slice(0, 10)}T23:59:59.999`).getTime()

const shiftDay = (day: string, days: number): string => format(addDays(parseISO(day.slice(0, 10)), days), 'yyyy-MM-dd')

/** The zakat figures now (no `asOf`) or as they stood at the end of `asOfDay`. */
export function zakatBaseAt(
  src: ZakatSources, cfg: ZakatConfig | null | undefined, asOfDay?: string, current?: ReadonlyMap<string, AccountBalance>, history?: BalancesAt,
): ZakatBase {
  const asOf = asOfDay ? endOfDayMs(asOfDay) : undefined
  const { ledger } = src
  return deriveZakatBase({
    savingsAccounts: [...ledger.savingsAccounts],
    investmentHoldings: src.investmentHoldings,
    debts: src.debts,
    debtPayments: src.debtPayments,
    savingsTransactions: ledger.savingsTransactions,
    baseCurrency: src.baseCurrency,
    exchangeRates: src.exchangeRates,
    goldPricePerGram: src.goldPricePerGram,
    goldPriceAvailable: src.goldPriceAvailable,
    lookup: src.lookup,
    config: cfg,
    asOf,
    ...zakatAccountsFromLedger(ledger, asOf, current, history),
  })
}

export function zakatResultAt(
  src: ZakatSources, cfg: ZakatConfig | null | undefined, asOfDay?: string, current?: ReadonlyMap<string, AccountBalance>, history?: BalancesAt,
): { base: ZakatBase; result: ZakatResult } {
  const base = zakatBaseAt(src, cfg, asOfDay, current, history)
  return { base, result: computeZakat(toZakatInput(base, cfg)) }
}

export type ZakatYearState = 'estimate' | 'dueNow' | 'notYet' | 'notDue'

/**
 * `notDue`: below nisab on the zakat date (or no nisab line). `notYet`: above it then, but below at the year start, so
 * the year has not run. Otherwise `estimate` before the zakat date and `dueNow` on or after it.
 */
export function zakatYearState(p: { today: string; zakatDate: string; start: ZakatResult; end: ZakatResult }): ZakatYearState {
  if (!p.end.due) return 'notDue'
  if (p.start.zakatable < p.start.nisab) return 'notYet'
  return p.today < p.zakatDate ? 'estimate' : 'dueNow'
}

export interface ZakatYear {
  state: ZakatYearState
  yearStart: string
  /** The zakat date has come (today is on or after it). */
  ended: boolean
  /** The lines behind `result`. */
  base: ZakatBase
  /** The figure to show: today's estimate before the zakat date, the zakat date's own wealth on or after it. */
  result: ZakatResult
  /** Items taken at today's value because they have no history that far back. */
  noHistoryCount: number
}

export function evaluateZakatYear(src: ZakatSources, cfg: ZakatConfig | null | undefined, zakatDate: string, today: string): ZakatYear {
  const yearStart = shiftDay(zakatDate, -LUNAR_YEAR_DAYS)
  const current = computeBalances(src.ledger)
  const start = zakatResultAt(src, cfg, yearStart, current)
  const end = zakatResultAt(src, cfg, today < zakatDate ? undefined : zakatDate, current)
  return {
    state: zakatYearState({ today, zakatDate, start: start.result, end: end.result }),
    yearStart,
    ended: today >= zakatDate,
    base: end.base,
    result: end.result,
    noHistoryCount: Math.max(start.base.noHistoryCount, end.base.noHistoryCount),
  }
}

/** At most this many days are rebuilt when looking for the day wealth reached nisab. */
const MAX_SCAN_DAYS = LUNAR_YEAR_DAYS + 31

/** The first day after `fromDay`, up to `toDay`, on which zakatable wealth was at or above nisab; null when none. */
export function firstNisabDay(src: ZakatSources, cfg: ZakatConfig | null | undefined, fromDay: string, toDay: string): string | null {
  const current = computeBalances(src.ledger)
  // The ledger is walked once; each day reads its balances off that one series.
  const history = balancesOverTime(src.ledger)
  for (let i = 1, day = shiftDay(fromDay, 1); i <= MAX_SCAN_DAYS && day <= toDay; i++, day = shiftDay(day, 1)) {
    const { result } = zakatResultAt(src, cfg, day, current, history)
    if (result.nisabAvailable && result.zakatable >= result.nisab) return day
  }
  return null
}
