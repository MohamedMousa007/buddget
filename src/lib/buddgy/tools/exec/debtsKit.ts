import { addByFrequency, installmentPaymentsCompleted } from '@/lib/debts/installmentSchedule'
import { getNextCreditCardDueDate } from '@/lib/debt/computeCreditCardBalance'
import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import type { Plan } from '@/lib/buddgy/tools/exec/planKit'
import { fail, money, text } from '@/lib/buddgy/tools/writeKit'
import type { Debt, DebtCurrency, FinanceStore } from '@/lib/store/types'
import { calculateDebtRemaining, type DebtBalanceContext } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { clampDebtFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { format, parseISO } from 'date-fns'

export const round2 = (n: number): number => Math.round(n * 100) / 100

export const balanceCtx = (s: FinanceStore): DebtBalanceContext => ({
  expenses: s.expenses,
  exchangeRates: s.exchangeRates,
  allDebts: s.debts,
})

export const remainingOf = (s: FinanceStore, d: Debt): number => calculateDebtRemaining(d, s.debtPayments, balanceCtx(s))

export const isOpen = (d: Debt): boolean => d.status !== 'cleared'

export const debtTitle = (d: Debt): string => d.name || d.personName || d.person

const personOf = (d: Debt): string => d.personName || d.person

export const fmtDebt = (amount: number, d: Debt): string =>
  d.isGold ? `${round2(amount)} g${d.goldKarat ? ` ${d.goldKarat}K` : ''}` : money(round2(amount), d.currency)

export const debtChoice = (d: Debt): { id: string; label: string } => {
  const who = personOf(d)
  return { id: refOf(d.id), label: who && who !== 'Installment' && who !== d.name ? `${debtTitle(d)} · ${who}` : debtTitle(d) }
}

export function findDebt(
  s: FinanceStore,
  input: unknown,
  accept: (d: Debt) => boolean = () => true,
): Plan<{ debt: Debt }> {
  const pool = s.debts.filter(accept)
  const hit = resolveByRefOrName(pool, input, debtTitle)
  if (hit.kind === 'one') return { debt: hit.item }
  const open = pool.filter(isOpen)
  const shown = (hit.kind === 'many' ? hit.items : open.length > 0 ? open : pool).slice(0, 15)
  return {
    error: fail(
      hit.kind === 'many' ? 'Several debts match that name.' : 'No debt matches that.',
      'Ask which one, or find it with list_debts.',
      shown.map(debtChoice),
    ),
  }
}

/** The debt's own currency unit for display and balance maths. */
export function parseDebtCurrency(
  s: FinanceStore,
  input: unknown,
  allowGold: boolean,
): Plan<{ currency: DebtCurrency }> {
  const base = s.settings.baseCurrency
  const wanted = text(input, 8)?.toUpperCase()
  if (!wanted) return { currency: base }
  if (wanted === 'XAU') {
    return allowGold ? { currency: 'XAU' } : { error: fail('Gold is not available here.') }
  }
  if (clampDebtFiatToAllowed(s.settings, wanted as DebtCurrency) !== wanted) {
    return { error: fail(`${wanted} is not an enabled currency.`, 'Ask which currency, or use the base currency.') }
  }
  if (tryConvertCurrency(1, wanted, base, s.exchangeRates) === null) {
    return { error: fail(`No exchange rate from ${wanted} to ${base}.`, 'Ask for the amount in the base currency.') }
  }
  return { currency: wanted as DebtCurrency }
}

export function nextDue(s: FinanceStore, d: Debt, now: Date): string | undefined {
  if (d.debtType === 'installment' && d.startDate && d.installmentFrequency && d.installmentCount) {
    const done = installmentPaymentsCompleted(d, s.debtPayments.filter((p) => p.debtId === d.id))
    if (done < d.installmentCount) return format(addByFrequency(parseISO(d.startDate), d.installmentFrequency, done), 'yyyy-MM-dd')
    return undefined
  }
  const schedule = s.recurringDebtPayments.find((r) => r.debtId === d.id && r.isActive)
  if (schedule) return schedule.nextDueDate
  return d.debtType === 'credit_card' ? (getNextCreditCardDueDate(d, now) ?? undefined) : undefined
}

