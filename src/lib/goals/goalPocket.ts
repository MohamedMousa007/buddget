import type { LedgerInput } from '@/lib/accounts/balance'
import { DEFAULT_CASH_ID, canHoldParts } from '@/lib/accounts/kinds'
import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { availableIn } from '@/lib/savings/pocketHome'
import type { Currency, FinanceStore, Goal, PaymentMethod, SavingsAccount } from '@/lib/store/types'

/** "Somewhere else (not tracked here)": the saved money is outside every tracked account. */
export const ELSEWHERE = 'elsewhere'
/** Where a new goal's already-saved money is: a tracked account's id, or {@link ELSEWHERE}. */
export type SavedHome = string

/**
 * Accounts that can already contain a goal's saved money: every tracked, open, counted account in the goal's
 * currency, the Cash account and wallets included. Cash or a wallet is never offered as a separate outside place.
 */
export function goalHomeAccounts(methods: readonly PaymentMethod[], currency: string): PaymentMethod[] {
  return methods.filter((m) => m.id !== DEFAULT_CASH_ID && canHoldParts(m) && String(m.currency) === currency)
}

export type SavedHomeProblem = 'choose_home' | 'over_available'

/** Why "already saved" cannot be recorded yet. Null when nothing is saved, no account could hold it, or the answer is valid. */
export function savedHomeProblem(ledger: LedgerInput, currency: Currency, saved: number, home: SavedHome | null | undefined): SavedHomeProblem | null {
  if (!(saved > 0)) return null
  const accounts = goalHomeAccounts(ledger.paymentMethods, currency)
  if (accounts.length === 0 || home === ELSEWHERE) return null
  if (!home || !accounts.some((a) => a.id === home)) return 'choose_home'
  return saved > availableIn(home, ledger) + balanceEpsilon(currency) ? 'over_available' : null
}

/** Where the user said a new goal's saved money is: in an account, in another pocket, or outside buddget. */
export type SavedSourceKind = 'account' | 'pocket' | 'outside'

/**
 * With the Pocket tab chosen, a saved amount needs a picked pocket: it never falls back to an account or to outside
 * money (that booked the amount twice, QA W3 P1). Null when nothing blocks the pocket answer.
 */
export function savedPocketProblem(kind: SavedSourceKind, pocketId: string | null | undefined, saved: number): 'choose_pocket' | null {
  return kind === 'pocket' && saved > 0 && !pocketId ? 'choose_pocket' : null
}

type GoalPocketStore = Pick<FinanceStore, 'addSavingsAccount' | 'updateGoal' | 'depositToSavings' | 'paymentMethods'> &
  Partial<Pick<FinanceStore, 'savingsAccounts' | 'transferBetweenPockets'>>

/**
 * A new goal's pocket and its already-saved money, the one writer behind the goal form and Buddgy's add_goal.
 * In a tracked account the pocket is set aside inside it (net worth unchanged, capped by the store at what is
 * available); elsewhere it stands on its own and the money is counted once as new. With `fromPocketId` the money
 * moves out of that pocket (same currency) into the new one, which is kept where the source is, so net worth stays
 * the same.
 */
export function createGoalPocket(
  s: GoalPocketStore,
  input: { goalId: string; pocketName: string; goalName: string; currency: Currency; saved: number; home?: SavedHome | null; fromPocketId?: string },
): { pocketId: string; savedRecorded: boolean } {
  if (input.fromPocketId && input.saved > 0) {
    const source = s.savingsAccounts?.find((a) => a.id === input.fromPocketId)
    const pocketId = s.addSavingsAccount({
      name: input.pocketName, category: 'savings', type: 'vault', currency: input.currency, goalId: input.goalId,
      ...(source?.heldInPaymentMethodId ? { heldInPaymentMethodId: source.heldInPaymentMethodId } : {}),
    })
    s.updateGoal(input.goalId, { linkedSavingsAccountIds: [pocketId] })
    const moved = !!source && source.currency === input.currency && !!s.transferBetweenPockets?.(source.id, pocketId, input.saved, input.goalName)
    return { pocketId, savedRecorded: moved }
  }
  const holder = input.saved > 0 && input.home && input.home !== ELSEWHERE && goalHomeAccounts(s.paymentMethods, input.currency).some((a) => a.id === input.home)
    ? input.home
    : undefined
  const pocketId = s.addSavingsAccount({
    name: input.pocketName, category: 'savings', type: 'vault', currency: input.currency, goalId: input.goalId,
    ...(holder ? { heldInPaymentMethodId: holder } : {}),
  })
  s.updateGoal(input.goalId, { linkedSavingsAccountIds: [pocketId] })
  const savedRecorded = !(input.saved > 0) || s.depositToSavings(pocketId, input.saved, input.currency, input.goalName, {
    mode: 'declare', source: 'goal_opening', ...(holder ? { paymentMethodId: holder } : {}),
  })
  return { pocketId, savedRecorded }
}

/**
 * Add money into a goal's pocket, creating and linking one when the goal has none. When `write` is refused, the pocket
 * this call made is deleted again (which also unlinks it), so the goal is left as it was. False when refused.
 */
export function depositIntoGoal(
  s: Pick<FinanceStore, 'addSavingsAccount' | 'updateGoal' | 'deleteSavingsAccount'>,
  goal: Pick<Goal, 'id' | 'currency' | 'linkedSavingsAccountIds'>,
  pocketId: string | undefined,
  pocketName: string,
  write: (pocketId: string) => boolean,
): boolean {
  if (pocketId) return write(pocketId)
  const created = s.addSavingsAccount({ name: pocketName, category: 'savings', type: 'vault', currency: goal.currency, goalId: goal.id })
  s.updateGoal(goal.id, { linkedSavingsAccountIds: [...goal.linkedSavingsAccountIds, created] })
  if (write(created)) return true
  s.deleteSavingsAccount(created)
  return false
}

/**
 * A goal's parts, the only rows a goal delete may move or touch: `goal_id` is the goal, or the goal lists the row (a
 * cached row from before the first pull has no goalId yet). A row another goal also lists is never touched.
 */
export function goalParts(goal: Pick<Goal, 'id' | 'linkedSavingsAccountIds'>, goals: readonly Pick<Goal, 'id' | 'linkedSavingsAccountIds'>[], accounts: readonly SavingsAccount[]): SavingsAccount[] {
  const elsewhere = new Set(goals.filter((g) => g.id !== goal.id).flatMap((g) => g.linkedSavingsAccountIds))
  return accounts.filter((a) => (a.goalId === goal.id || goal.linkedSavingsAccountIds.includes(a.id)) && !elsewhere.has(a.id))
}

/**
 * The user picks `pocketId` for the goal on its detail sheet. No money moves ("keeps every amount where it is"): the
 * picked row becomes one of the goal's parts (unless the goal already has a part in that account: one part per home,
 * I-13), and parts that still hold money stay. Goal readers use the linked array until P5, so it is kept in step:
 * the picked pocket first, as the one new money goes to; an empty old one is let go.
 */
export function pickGoalPocket(
  s: Pick<FinanceStore, 'updateGoal' | 'updateSavingsAccount' | 'savingsAccounts'> & Partial<Pick<FinanceStore, 'goals'>>,
  goal: Pick<Goal, 'id' | 'linkedSavingsAccountIds'>,
  pocketId: string,
): void {
  const picked = s.savingsAccounts.find((p) => p.id === pocketId)
  if (!picked) return
  const clash = !!picked.heldInPaymentMethodId && s.savingsAccounts.some((p) => p.id !== pocketId && p.goalId === goal.id && p.heldInPaymentMethodId === picked.heldInPaymentMethodId)
  // A pocket another goal still lists stays shared (no goal_id): stamping it would hand it to this goal alone.
  const sharedElsewhere = (s.goals ?? []).some((g) => g.id !== goal.id && g.linkedSavingsAccountIds.includes(pocketId))
  if (!picked.goalId && !picked.isMonthlySavings && !clash && !sharedElsewhere) s.updateSavingsAccount(pocketId, { goalId: goal.id })
  const holding = goal.linkedSavingsAccountIds.filter((id) => id !== pocketId && (s.savingsAccounts.find((p) => p.id === id)?.currentBalance ?? 0) > 0)
  s.updateGoal(goal.id, { linkedSavingsAccountIds: [pocketId, ...holding] })
}
