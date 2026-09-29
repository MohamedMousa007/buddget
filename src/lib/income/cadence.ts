import type { Dictionary } from '@/lib/i18n'
import type { IncomeSource } from '@/lib/store/types'

/** "Monthly · 22", "Bi-weekly · 1 / 15" — how often a payday comes, as Paydays shows it. */
export function cadenceLine(source: IncomeSource, t: Dictionary): string {
  const freq = source.recurringFrequency ?? 'monthly'
  if (freq === 'monthly') return `${t.addIncome.freqMonthly} · ${source.dayOfMonth ?? 1}`
  const label = freq === 'weekly' ? t.addIncome.freqWeekly : t.addIncome.freqBiweekly
  return source.paydayDays?.length ? `${label} · ${source.paydayDays.join(' / ')}` : label
}
