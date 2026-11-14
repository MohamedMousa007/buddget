import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Currency, Expense } from '@/lib/store/types'
import { expenseAmountInBase, filterExpensesByMonth } from '@/lib/utils/calculations'

/**
 * Cash withdrawn from a bank account stays out of spending ("ATM Cash Withdrawal" is a non-spend category). The user is
 * asked once whether they log what they spend in cash. "No" makes the server book each NEW withdrawal as ordinary
 * spending; rows already booked never change. Unanswered behaves as "yes". The key strings are a contract with the server.
 */
export const CASH_LOG_YES = 'cashlog:yes'
export const CASH_LOG_NO = 'cashlog:no'
export const ATM_CATEGORY = 'ATM Cash Withdrawal'

export type CashLogAnswer = 'yes' | 'no' | null

/** Keys are never deleted (settings sync does not propagate deletions), so the later answer wins. */
export function cashLogAnswer(promptState: Record<string, string> | undefined): CashLogAnswer {
  const yes = promptState?.[CASH_LOG_YES]
  const no = promptState?.[CASH_LOG_NO]
  if (!yes && !no) return null
  if (!no) return 'yes'
  if (!yes) return 'no'
  return Date.parse(no) > Date.parse(yes) ? 'no' : 'yes'
}

export function answerCashLog(answer: 'yes' | 'no'): void {
  const key = answer === 'yes' ? CASH_LOG_YES : CASH_LOG_NO
  useSettingsStore.getState().dismissBanner(key)
  const current = useFinanceStore.getState().settings.promptState ?? {}
  useFinanceStore.getState().updateSettings({ promptState: { ...current, [key]: new Date().toISOString() } })
}

export function cashWithdrawnThisCycle(
  expenses: Expense[],
  monthKey: string,
  monthStartDay: number,
  base: Currency,
  rates: Record<string, number>,
): number {
  return filterExpensesByMonth(expenses, monthKey, monthStartDay)
    .filter((e) => e.category === ATM_CATEGORY && !e.refundKind)
    .reduce((sum, e) => sum + expenseAmountInBase(e, base, rates), 0)
}
