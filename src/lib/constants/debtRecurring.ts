import type { DebtRecurringFrequency } from '@/lib/store/types'

export const RECURRING_DEBT_FREQUENCIES: { value: DebtRecurringFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
]
