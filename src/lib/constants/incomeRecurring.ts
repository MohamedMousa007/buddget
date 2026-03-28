import type { IncomeRecurringFrequency } from '@/lib/store/types'

export const INCOME_RECURRING_FREQ_OPTIONS: {
  value: IncomeRecurringFrequency
  label: string
  amountHint: string
}[] = [
  { value: 'monthly', label: 'Monthly', amountHint: 'Amount is per month.' },
  { value: 'biweekly', label: 'Bi-weekly', amountHint: 'Amount is per paycheck (26 per year).' },
  { value: 'weekly', label: 'Weekly', amountHint: 'Amount is per week.' },
]
