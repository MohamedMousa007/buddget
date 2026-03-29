import type { IncomeRecurringFrequency } from '@/lib/store/types'

export const INCOME_RECURRING_FREQ_OPTIONS: {
  value: IncomeRecurringFrequency
  label: string
  amountHint: string
}[] = [
  { value: 'monthly', label: 'Monthly', amountHint: 'This is your monthly amount.' },
  { value: 'biweekly', label: 'Bi-weekly', amountHint: 'This is per paycheck (26 times a year).' },
  { value: 'weekly', label: 'Weekly', amountHint: 'This is your weekly amount.' },
]
