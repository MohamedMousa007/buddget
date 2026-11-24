import type { LedgerInput } from '@/lib/accounts/balance'
import { DEFAULT_CASH_ID, isTracked } from '@/lib/accounts/kinds'
import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { availableIn } from '@/lib/savings/pocketHome'
import type { Currency, FinanceStore, PaymentMethod } from '@/lib/store/types'

/** "Somewhere else (not tracked here)": the saved money is outside every tracked account. */
export const ELSEWHERE = 'elsewhere'
/** Where a new goal's already-saved money is: a tracked account's id, or {@link ELSEWHERE}. */
export type SavedHome = string

/**
 * Accounts that can already contain a goal's saved money: every tracked, open, counted account in the goal's
 * currency, the Cash account and wallets included. Cash or a wallet is never offered as a separate outside place.
 */
export function goalHomeAccounts(methods: readonly PaymentMethod[], currency: string): PaymentMethod[] {
  return methods.filter((m) => m.id !== DEFAULT_CASH_ID && isTracked(m) && !m.closedAt && !m.excluded && String(m.currency) === currency)
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

type GoalPocketStore = Pick<FinanceStore, 'addSavingsAccount' | 'updateGoal' | 'depositToSavings' | 'paymentMethods'>

/**
 * A new goal's pocket and its already-saved money, the one writer behind the goal form and Buddgy's add_goal.
 * In a tracked account the pocket is set aside inside it (net worth unchanged, capped by the store at what is
 * available); elsewhere it stands on its own and the money is counted once as new.
 */
export function createGoalPocket(
  s: GoalPocketStore,
  input: { goalId: string; pocketName: string; goalName: string; currency: Currency; saved: number; home?: SavedHome | null },
): { pocketId: string; savedRecorded: boolean } {
  const holder = input.saved > 0 && input.home && input.home !== ELSEWHERE && goalHomeAccounts(s.paymentMethods, input.currency).some((a) => a.id === input.home)
    ? input.home
    : undefined
  const pocketId = s.addSavingsAccount({
    name: input.pocketName, category: 'savings', type: 'vault', currency: input.currency,
    ...(holder ? { heldInPaymentMethodId: holder } : {}),
  })
  s.updateGoal(input.goalId, { linkedSavingsAccountIds: [pocketId] })
  const savedRecorded = !(input.saved > 0) || s.depositToSavings(pocketId, input.saved, input.currency, input.goalName, {
    mode: 'declare', source: 'goal_opening', ...(holder ? { paymentMethodId: holder } : {}),
  })
  return { pocketId, savedRecorded }
}
