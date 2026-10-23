import { isOpenAccount } from '@/lib/accounts/kinds'
import type { FinanceStore } from '@/lib/store/types'
import type { EligibilityInput } from './eligibility'

type Slices = Pick<
  FinanceStore,
  | 'paymentMethods' | 'incomeSources' | 'incomeEvents' | 'expenses' | 'budgetPlans' | 'debts' | 'goals' | 'subscriptions'
  | 'savingsAccounts' | 'recurringExpenses' | 'investmentHoldings'
>

/** How much of a life the account already holds, in the shape the eligibility check reads. */
export function heldRecords(s: Slices): Pick<EligibilityInput, 'openAccounts' | 'incomeSources' | 'incomeEvents' | 'expenses' | 'plans' | 'others'> {
  return {
    openAccounts: s.paymentMethods.filter(isOpenAccount).length,
    incomeSources: s.incomeSources.length,
    incomeEvents: s.incomeEvents.length,
    expenses: s.expenses.length,
    plans: s.budgetPlans.length,
    others: s.debts.length + s.goals.length + s.subscriptions.length + s.savingsAccounts.length + s.recurringExpenses.length + s.investmentHoldings.length,
  }
}
