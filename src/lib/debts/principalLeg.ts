import type { Debt, Expense, IncomeEvent, PaymentMethod } from '@/lib/store/types'
import { DEFAULT_CASH_ID, isTracked } from '@/lib/accounts/kinds'
import { resolveAccountId } from '@/lib/accounts/resolve'
import { instantOf, minorUnit } from '@/lib/accounts/balance'
import { PERSON_TRANSFER_CATEGORIES } from '@/lib/constants/categoryMeta'

const DAY = 86_400_000
/** How far a bank message may sit from the debt and still be the same money. */
export const PRINCIPAL_MATCH_DAYS = 3
const RECEIVED = new Set(['confirmed', 'late', 'partial'])

/**
 * The account a debt's principal can move through the picked method: an open, tracked balance holder (bank, cash,
 * wallet, prepaid; a debit card stands for its parent). Null for a credit card, BNPL, an untracked or closed account:
 * those never get a principal leg.
 */
export function principalAccount(methodId: string | undefined, methods: readonly PaymentMethod[]): PaymentMethod | null {
  const id = resolveAccountId(methodId, methods)
  if (!id || id === DEFAULT_CASH_ID) return null
  const pm = methods.find((m) => m.id === id)
  return pm && isTracked(pm) && !pm.closedAt ? pm : null
}

/** Default answer to "did the money move now?": yes only when the account's balance already runs at that instant. */
export const principalMovesByDefault = (account: Pick<PaymentMethod, 'openingAt'>, at: number): boolean =>
  account.openingAt != null && at > new Date(account.openingAt).getTime()

export type PrincipalMatch = { kind: 'expense' | 'income'; id: string; date: string }

/**
 * The ledger row that already is this debt's money: a transfer out of the account (lending) or a one-off credit into
 * it (borrowing) with the same amount and currency, a few days around `at`, not yet tied to anything. Linking it
 * instead of adding a principal leg keeps the account from moving twice for one transfer. Closest in time wins.
 */
export function findPrincipalMatch(args: {
  direction: Debt['direction']
  accountId: string
  amount: number
  currency: string
  at: number
  expenses: readonly Expense[]
  incomeEvents: readonly IncomeEvent[]
  paymentMethods: readonly PaymentMethod[]
}): PrincipalMatch | null {
  const { accountId, amount, currency, at, paymentMethods: pms } = args
  if (!(amount > 0)) return null
  const u = minorUnit(currency)
  const sameMoney = (a: number, c: string) => String(c) === currency && Math.round(a * u) === Math.round(amount * u)
  const near = (t: number) => Math.abs(t - at) <= PRINCIPAL_MATCH_DAYS * DAY
  const found: (PrincipalMatch & { gap: number })[] = []
  if (args.direction === 'they_owe') {
    for (const e of args.expenses) {
      if (!PERSON_TRANSFER_CATEGORIES.has(e.category) || e.spendExclusion || e.refundKind || e.refundedAt || e.fundedFromSavingsTxId) continue
      if (e.linkedDebtId || e.linkedDebtPaymentId || e.isDebtPayment) continue
      // A message the server could not place debits no account: linking it would leave the loan with no leg at all.
      if (!e.paymentMethodId || e.paymentMethodId === DEFAULT_CASH_ID) continue
      if (resolveAccountId(e.paymentMethodId, pms) !== accountId || !sameMoney(e.amount, e.currency)) continue
      const t = instantOf(e.occurredAt, e.date)
      if (near(t)) found.push({ kind: 'expense', id: e.id, date: e.date.slice(0, 10), gap: Math.abs(t - at) })
    }
  } else {
    for (const i of args.incomeEvents) {
      if (!RECEIVED.has(i.status) || i.templateId || i.linkedDebtId || i.linkedSavingsAccountId || i.exclusion) continue
      if (!i.paymentMethodId || resolveAccountId(i.paymentMethodId, pms) !== accountId || !sameMoney(i.amount, i.currency)) continue
      const t = instantOf(i.occurredAt, i.receivedDate)
      if (near(t)) found.push({ kind: 'income', id: i.id, date: i.receivedDate.slice(0, 10), gap: Math.abs(t - at) })
    }
  }
  found.sort((a, b) => a.gap - b.gap)
  const best = found[0]
  return best ? { kind: best.kind, id: best.id, date: best.date } : null
}

/** The fields that give a new debt its principal leg. */
export function principalLegFields(account: Pick<PaymentMethod, 'id'>, amount: number, currency: Debt['currency'], at: string):
  Pick<Debt, 'principalPaymentMethodId' | 'principalAmount' | 'principalCurrency' | 'principalAt'> {
  return { principalPaymentMethodId: account.id, principalAmount: amount, principalCurrency: currency, principalAt: at }
}

/**
 * What linking a matched row to its debt writes. The transfer out stays in the ledger and keeps its account debit,
 * but leaves spending (lent money is not consumption). The credit keeps its account credit and is marked as borrowed
 * money, the same shape "borrowed money" income already has.
 */
export const linkedExpensePatch = (debtId: string): Pick<Expense, 'linkedDebtId' | 'spendExclusion'> =>
  ({ linkedDebtId: debtId, spendExclusion: 'manual' })
export const linkedIncomePatch = (debtId: string): Pick<IncomeEvent, 'linkedDebtId' | 'sourceType'> =>
  ({ linkedDebtId: debtId, sourceType: 'debt' })

/** A transfer that was linked to a lent debt as its principal (never a payment row, never a BNPL purchase). */
export const isLinkedPrincipalExpense = (e: Pick<Expense, 'linkedDebtId' | 'isDebtPayment' | 'linkedDebtPaymentId' | 'spendExclusion'>, debt: Pick<Debt, 'id' | 'direction' | 'debtType'>): boolean =>
  debt.direction === 'they_owe' && debt.debtType === 'personal' && e.linkedDebtId === debt.id
  && !e.isDebtPayment && !e.linkedDebtPaymentId && e.spendExclusion === 'manual'
