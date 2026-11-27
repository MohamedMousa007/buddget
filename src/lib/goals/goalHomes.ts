import type { Goal, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { partsOfGoal } from '@/lib/goals/computeGoalProgress'
import { pocketHome } from '@/lib/savings/pocketHome'
import { accountTitle } from '@/lib/accounts/accountTitle'
import { formatQuantity, formatWhole } from '@/lib/utils/formatters'

/** One place a goal's money sits: a part set aside in an account, gold, or other money outside the accounts. */
export interface GoalHome {
  part: SavingsAccount
  kind: 'account' | 'gold' | 'outside'
  /** The holding account (kind `account`). */
  account?: PaymentMethod
  /** In the part's own unit: "12,000", "400 USD", "18" (grams). */
  amount: string
}

export interface GoalHomeWords {
  homeIn: (amount: string, place: string) => string
  homeGold: (grams: string) => string
  homeOutside: (amount: string) => string
}

/** The goal's parts that hold money, each with where it sits (final-ui v9: "$400 in Deel · 18 g gold · 12,000 in CIB"). */
export function goalHomes(goal: Pick<Goal, 'id' | 'linkedSavingsAccountIds'>, accounts: readonly SavingsAccount[], methods: readonly PaymentMethod[], base: string): GoalHome[] {
  return partsOfGoal(goal, accounts)
    .filter((p) => p.currentBalance > 0)
    .map((part): GoalHome => {
      if (part.currency === 'XAU') return { part, kind: 'gold', amount: formatQuantity(part.currentBalance, 'gold') }
      const amount = part.currency === base ? formatWhole(part.currentBalance) : `${formatWhole(part.currentBalance)} ${part.currency}`
      const home = pocketHome(part, methods)
      const account = home.kind === 'reserved' ? methods.find((m) => m.id === home.accountId) : undefined
      return account ? { part, kind: 'account', account, amount } : { part, kind: 'outside', amount }
    })
}

/** Each home as one segment of the homes line. */
export function homeSegment(h: GoalHome, w: GoalHomeWords): string {
  if (h.kind === 'gold') return w.homeGold(h.amount)
  if (h.kind === 'account' && h.account) return w.homeIn(h.amount, accountTitle(h.account))
  return w.homeOutside(h.amount)
}
