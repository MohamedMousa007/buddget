import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt, Expense, IncomeEvent, IncomeSource, PaymentMethod } from '@/lib/store/types'
import { resolveAccountId } from '@/lib/accounts/resolve'
import { settlePrompt } from '@/lib/prompts/settle'
import { findPrincipalMatch, linkedExpensePatch, linkedIncomePatch, type PrincipalMatch } from './principalLeg'

/**
 * A bank message (or a hand-entered row) that arrives AFTER a debt was booked with a principal leg is the same money
 * a second time: the leg moved the account and now the row moves it again. Nothing is dropped by itself. The user is
 * asked once per debt and row; "Yes" keeps the bank row, ties it to the debt and removes the leg, "No" is remembered.
 */

/** Remembered "No" for one debt and one row (synced with the other settled prompts). */
export const principalDuplicateKey = (debtId: string, rowId: string): string => `principaldup:${debtId}:${rowId}`

export interface PrincipalDuplicate { debt: Debt; match: PrincipalMatch }

const hasLeg = (d: Debt): d is Debt & { principalPaymentMethodId: string; principalAmount: number; principalAt: string } =>
  Boolean(d.principalPaymentMethodId && d.principalAmount && d.principalAt) && !d.isGold

/** Open personal debts that still carry a leg, each with the unlinked ledger row that looks like the same money. */
export function pendingPrincipalDuplicates(s: {
  debts: readonly Debt[]
  expenses: readonly Expense[]
  incomeEvents: readonly IncomeEvent[]
  incomeSources: readonly IncomeSource[]
  paymentMethods: readonly PaymentMethod[]
  monthStartDay: number
  rates: Record<string, number>
  promptState: Record<string, string> | undefined
  today?: Date
}): PrincipalDuplicate[] {
  const out: PrincipalDuplicate[] = []
  const claimed = new Set<string>()
  for (const debt of s.debts) {
    if (debt.debtType !== 'personal' || debt.status === 'cleared' || !hasLeg(debt)) continue
    const accountId = resolveAccountId(debt.principalPaymentMethodId, s.paymentMethods)
    if (!accountId) continue
    const declined = [...s.expenses, ...s.incomeEvents].filter((r) => s.promptState?.[principalDuplicateKey(debt.id, r.id)]).map((r) => r.id)
    const match = findPrincipalMatch({
      direction: debt.direction,
      accountId,
      amount: debt.principalAmount,
      currency: String(debt.principalCurrency ?? debt.currency),
      at: new Date(debt.principalAt).getTime(),
      expenses: s.expenses,
      incomeEvents: s.incomeEvents,
      incomeSources: s.incomeSources,
      monthStartDay: s.monthStartDay,
      rates: s.rates,
      paymentMethods: s.paymentMethods,
      skipIds: new Set([...declined, ...claimed]),
      today: s.today,
    })
    if (!match) continue
    claimed.add(match.id)
    out.push({ debt, match })
  }
  return out
}

const NO_LEG = { principalPaymentMethodId: undefined, principalAmount: undefined, principalCurrency: undefined, principalAt: undefined } satisfies Partial<Debt>

/**
 * "Yes, same money": the bank row stays and becomes the debt's principal, the leg goes, so the account moved once.
 * One store write, so no reader ever sees the row linked and the leg still there. Returns Undo.
 */
export function confirmPrincipalDuplicate({ debt, match }: PrincipalDuplicate): () => void {
  const before = useFinanceStore.getState()
  const expense = match.kind === 'expense' ? before.expenses.find((e) => e.id === match.id) : undefined
  const income = match.kind === 'income' ? before.incomeEvents.find((i) => i.id === match.id) : undefined
  const prevDebt = before.debts.find((d) => d.id === debt.id)
  if (!prevDebt || (!expense && !income)) return () => {}
  const write = (d: Debt, e: Expense | undefined, i: IncomeEvent | undefined) => {
    const at = new Date().toISOString()
    useFinanceStore.setState((s) => ({
      debts: s.debts.map((x) => (x.id === d.id ? { ...d, updatedAt: at } : x)),
      expenses: e ? s.expenses.map((x) => (x.id === e.id ? { ...e, updatedAt: at } : x)) : s.expenses,
      incomeEvents: i ? s.incomeEvents.map((x) => (x.id === i.id ? { ...i, updatedAt: at } : x)) : s.incomeEvents,
    }))
  }
  write(
    { ...prevDebt, ...NO_LEG },
    expense && { ...expense, ...linkedExpensePatch(debt.id) },
    income && { ...income, ...linkedIncomePatch(debt.id) },
  )
  return () => write(prevDebt, expense, income)
}

/** "No, different money": both stay as booked and this pair is never asked about again. */
export function declinePrincipalDuplicate({ debt, match }: PrincipalDuplicate): void {
  settlePrompt(principalDuplicateKey(debt.id, match.id))
}
