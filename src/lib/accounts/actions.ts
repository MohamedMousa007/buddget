import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, FinanceStore, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { computeBalances, type LedgerInput } from './balance'
import { balanceDelta, balanceSave } from './balanceEdit'
import { DEFAULT_CASH_ID, isTracked } from './kinds'
import { removePaymentMethod } from './removePaymentMethod'
import { cashAccountId } from './resolve'
import { ownerPartIn } from '@/lib/savings/labels'
import { partId } from '@/lib/savings/partId'
import { inAccount, planMove, planSpent, shortOf } from '@/lib/savings/shortfall'

const store = () => useFinanceStore.getState()

/** Gives an account its starting balance; everything dated before this instant is ignored by the engine. */
export function setOpeningBalance(accountId: string, balance: number, at: Date = new Date()): void {
  store().updatePaymentMethod(accountId, { openingBalance: balance, openingAt: at.toISOString() })
}

/** The user's system Cash id: fixed per user, so every device creates the same row (docs/SYSTEM_CASH_PLAN.md). */
export function systemCashId(userId: string): string {
  const hex = userId.replace(/-/g, '').toLowerCase().split('').map((c) => (15 - parseInt(c, 16)).toString(16)).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * An edit time older than any real edit: the server keeps the newest edit (migration 0241), so a late create from
 * another device can never overwrite a balance the user set on this row.
 */
const SEED_EDIT_AT = '2000-01-01T00:00:00.000Z'

/**
 * The Cash account as a real, syncable row: the user's existing real Cash, else the system Cash created untracked
 * (no opening balance, so it stays out of net worth). Signed out there is no user id, and a random id is used.
 */
export function ensureCashAccount(): string {
  const { paymentMethods, settings, profile, addPaymentMethod } = store()
  const existing = cashAccountId(paymentMethods)
  if (existing && existing !== DEFAULT_CASH_ID) return existing
  if (!profile.id) return addPaymentMethod({ name: 'Cash', type: 'cash', currency: settings.baseCurrency, isDefault: false, color: '#C9C9D4' })
  const id = systemCashId(profile.id)
  const row: PaymentMethod = { id, name: 'Cash', type: 'cash', currency: settings.baseCurrency, isDefault: false, color: '#C9C9D4', createdAt: SEED_EDIT_AT, updatedAt: SEED_EDIT_AT }
  useFinanceStore.setState((s) => (s.paymentMethods.some((m) => m.id === id) ? {} : { paymentMethods: [...s.paymentMethods, row] }))
  return id
}

/** Gives a user without a real Cash their system Cash. Call only once the server's data is merged. Returns whether it created one. */
export function seedSystemCash(): boolean {
  const { paymentMethods, profile } = store()
  if (!profile.id) return false
  const existing = cashAccountId(paymentMethods)
  if (existing && existing !== DEFAULT_CASH_ID) return false
  ensureCashAccount()
  return true
}

/** Cash out: money leaves the account and becomes Cash. One non-spend row, two balance deltas. */
export function cashOut(fromId: string, amount: number, currency: PaymentMethod['currency'], at: Date = new Date()): void {
  store().addExpense({
    occurredAt: at.toISOString(),
    description: 'Cash out',
    category: 'ATM Cash Withdrawal',
    amount,
    currency,
    date: localTodayISO(at),
    paymentMethodId: fromId,
    toPaymentMethodId: ensureCashAccount(),
    isRecurring: false,
  })
}

/**
 * The pocket Set aside starts on: one held in this account (the money then stays in it and only "free" shrinks), else the
 * first. A pocket held elsewhere takes the money out of the account, so it is never the silent default.
 */
export function defaultSetAsidePocketId(pockets: readonly Pick<SavingsAccount, 'id' | 'heldInPaymentMethodId'>[], accountId: string): string | null {
  return (pockets.find((p) => p.heldInPaymentMethodId === accountId) ?? pockets[0])?.id ?? null
}

/** Set aside: a pocket deposit stamped with the account it came from (earmark when the pocket is held in it). */
export function setAside(fromId: string, pocketId: string, amount: number, currency: PaymentMethod['currency'], at: Date = new Date()): void {
  store().depositToSavings(pocketId, amount, currency, undefined, { mode: 'declare', paymentMethodId: fromId, date: localTodayISO(at), occurredAt: at.toISOString() })
}

/**
 * "What does your bank show now?": an anchor (I-1), the bank's balance at this instant. Rows dated before it are inside
 * it; `delta` keeps the difference for display. Never an expense.
 */
export function updateBalance(accountId: string, current: number, reported: number, reason: 'manual_update' | 'gap' = 'manual_update'): number {
  const account = store().paymentMethods.find((m) => m.id === accountId)
  const save = balanceSave(accountId !== DEFAULT_CASH_ID && (!account || isTracked(account)), current, reported, account ? String(account.currency) : '')
  if (save.kind === 'opening') {
    setOpeningBalance(accountId === DEFAULT_CASH_ID ? ensureCashAccount() : accountId, save.amount)
    return balanceDelta(current, reported, account ? String(account.currency) : '')
  }
  if (save.kind === 'none') return 0
  store().addAccountAdjustment({ paymentMethodId: accountId, delta: save.delta, anchorBalance: reported, reason, occurredAt: new Date().toISOString() })
  return save.delta
}

/**
 * "Where is this money?" (§4.9), money that was already saved: an `opening` label, never income, never this month's
 * saving. In Cash at home it first raises Cash by the amount (an anchor, reason `opening_correction`), since that money
 * was never in the ledger; an untracked Cash gets its opening balance. Elsewhere the account already holds it.
 * `partId` must already exist (see {@link ensureGoalPart}). False when refused.
 */
export function addAlreadySaved(partId: string, amount: number, at: Date = new Date()): boolean {
  const s = store()
  const part = s.savingsAccounts.find((p) => p.id === partId)
  if (!part || !(amount > 0)) return false
  const cash = part.heldInPaymentMethodId ? s.paymentMethods.find((m) => m.id === part.heldInPaymentMethodId && m.type === 'cash') : undefined
  if (cash) {
    const current = computeBalances(ledgerOf(s)).get(cash.id)?.balance
    if (current == null) setOpeningBalance(cash.id, amount, at)
    else s.addAccountAdjustment({ paymentMethodId: cash.id, delta: amount, anchorBalance: current + amount, reason: 'opening_correction', occurredAt: at.toISOString() })
  }
  return store().setAsideInPart(partId, amount, { source: 'opening', date: localTodayISO(at), occurredAt: new Date(at.getTime() + 1).toISOString() })
}

/** The goal's part in `accountId`: the existing one, else a new row with the deterministic id (§4.7), linked to the goal. */
export function ensureGoalPart(goalId: string, accountId: string): string | null {
  const s = store()
  const goal = s.goals.find((g) => g.id === goalId)
  const account = s.paymentMethods.find((m) => m.id === accountId)
  if (!goal || !account) return null
  const existing = ownerPartIn(s.savingsAccounts, { goalId }, accountId)
  const id = existing?.id ?? s.addSavingsAccount({
    id: partId({ goalId }, accountId), name: goal.name, category: 'savings', type: 'vault', currency: account.currency as Currency, goalId, heldInPaymentMethodId: accountId,
  } as Parameters<FinanceStore['addSavingsAccount']>[0])
  if (!goal.linkedSavingsAccountIds.includes(id)) s.updateGoal(goalId, { linkedSavingsAccountIds: [...goal.linkedSavingsAccountIds, id] })
  return id
}

/**
 * Closed accounts keep their history; their cards become standalone cards. False while money is still set aside in it:
 * the caller opens "Where did this money go?" ({@link answerSetAsideMoney} with `need` = everything held), then closes.
 */
export function closeAccount(accountId: string): boolean {
  let refused = false
  useFinanceStore.setState((s) => {
    const removal = removePaymentMethod(s, accountId, 'close')
    if (removal === 'needs_answer') refused = true
    return removal && removal !== 'needs_answer' ? { paymentMethods: removal.paymentMethods } : {}
  })
  return !refused
}

/** What is set aside in an account and not covered by its balance: the shortfall still to answer. */
export const shortIn = (accountId: string): number => shortOf(ledgerOf(store()), accountId)

/** Everything set aside in an account, in its currency (what closing it must answer for). */
export function heldIn(accountId: string): number {
  const s = store()
  const cur = String(s.paymentMethods.find((m) => m.id === accountId)?.currency ?? '')
  const input = ledgerOf(s)
  return s.savingsAccounts.filter((p) => p.heldInPaymentMethodId === accountId).reduce((n, p) => n + Math.max(0, inAccount(input, p, cur) ?? 0), 0)
}

export type SetAsideAnswer = { kind: 'move'; toId: string } | { kind: 'spent' }

/**
 * Answers "What happened?" / "Where did this money go?" for `need` of what is set aside in `accountId` (the shortfall,
 * or everything when closing): moves to another account (whole pockets, goal and Monthly savings parts as far as that
 * account has free, at the booked rate of the transfer that took the money there), or I spent it. Labels only (I-4).
 * Returns what is still unanswered, so the sheet can loop on the rest.
 */
export function answerSetAsideMoney(accountId: string, answer: SetAsideAnswer, need: number): number {
  const s = store()
  const day = { date: localTodayISO(), occurredAt: new Date().toISOString() }
  if (answer.kind === 'spent') {
    let left = need
    for (const step of planSpent(ledgerOf(s), s.goals, accountId, need)) {
      if (store().markSpent(step.partId, step.amount, day)) left -= step.amountInAccount
    }
    return Math.max(0, left)
  }
  const plan = planMove(ledgerOf(s), s.goals, accountId, answer.toId, need)
  let left = need
  for (const step of plan.steps) {
    if (store().movePart(step.partId, answer.toId, step.amount, { ...day, amountInB: step.amountInB })) left -= step.amountInAccount
  }
  return Math.max(0, left)
}

const ledgerOf = (s: FinanceStore): LedgerInput => ({
  paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
  savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
  convert: (a, from, to) => tryConvertCurrency(a, from, to, s.exchangeRates),
})

/**
 * Cash moves to another currency. Untracked Cash is relabelled. Tracked Cash's opening balance and adjustments are bare
 * numbers in the account's currency, so a relabel alone would silently reinterpret them (1,000 AED read as 1,000 EGP):
 * the user's amount in the new currency is recorded as an explicit adjustment against what the engine reads once
 * relabelled, so the balance ends at exactly that amount (the same adjustment path as Update balance).
 */
export function changeCashCurrency(id: string, to: Currency, amountInNew: number): void {
  if (store().paymentMethods.find((m) => m.id === id)?.type !== 'cash') return
  changeAccountCurrency(id, to, amountInNew)
}

/** Debit and prepaid cards follow their account's currency; a credit card keeps its own. */
export const followsAccountCurrency = (card: PaymentMethod): boolean => card.type === 'debit_card' || card.type === 'prepaid_card'

/** The account's open debit and prepaid cards that are not in `to` yet: the ones a currency change offers to move too. */
export function cardsToFollow(methods: readonly PaymentMethod[], accountId: string, to: Currency): PaymentMethod[] {
  return methods.filter((m) => m.parentId === accountId && !m.closedAt && followsAccountCurrency(m) && m.currency !== to)
}

/**
 * Any account moves to another currency, its balance ending at `amountInNew` (the Cash rule above, for a bank or wallet
 * too). `cardIds` relabels those of its cards too (only its own debit and prepaid cards; a credit card never changes).
 * A relabel only: past rows keep their amounts and currency, nothing is converted.
 */
export function changeAccountCurrency(id: string, to: Currency, amountInNew: number, { cardIds = [] }: { cardIds?: readonly string[] } = {}): void {
  const before = store().paymentMethods.find((m) => m.id === id)
  if (!before || before.currency === to) return
  store().updatePaymentMethod(id, { currency: to })
  for (const card of cardsToFollow(store().paymentMethods, id, to)) {
    if (cardIds.includes(card.id)) store().updatePaymentMethod(card.id, { currency: to })
  }
  if (!isTracked(before)) return
  const current = computeBalances(ledgerOf(store())).get(id)?.balance ?? 0
  updateBalance(id, current, amountInNew)
}
