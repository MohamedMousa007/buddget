import type { Locale } from '@/lib/i18n/types'
import { arPlural } from '@/lib/i18n/arPlural'
import type { GoalFrequency } from '@/lib/store/types'

const AR_YEAR = { one: 'سنة', two: 'سنتين', few: 'سنوات', many: 'سنة', fem: true }

/**
 * Goal frequency strings (monthly, every 3 months, yearly). No React here, so the notification cron can render the
 * yearly "behind" alert too; the app reads them through `useGoalsLtCopy().frequency`.
 */
const EN = {
  every: { monthly: 'Every month', quarterly: '3 months', yearly: 'Every year' } as Record<GoalFrequency, string>,
  /** A fixed plan's amount with its period: "2,000 a month", "6,000 every 3 months", "24,000 a year". */
  amountPer: (amount: string, f: GoalFrequency) =>
    f === 'yearly' ? `${amount} a year` : f === 'quarterly' ? `${amount} every 3 months` : `${amount} a month`,
  howOften: 'How often',
  checkedMonthly: 'Checked each month.',
  checkedOnDue: (perMonth: string) =>
    `Checked on each due date, so the months between never show you as behind. Counts as about ${perMonth} a month in your budget.`,
  /** Plan row label in the goal sheet. */
  eachLabel: { monthly: 'Each month', quarterly: 'Every 3 months', yearly: 'Each year' } as Record<GoalFrequency, string>,
  behindBody: (name: string, count: number, move: string | null, raise: string | null) =>
    `${name} has been behind for ${count} ${count === 1 ? 'year' : 'years'}.` +
    (move && raise ? ` Move the date to ${move} or add ${raise} a year.` : move ? ` Move the date to ${move}.` : raise ? ` Add ${raise} a year.` : ''),
  bannerBehind: (name: string, count: number) => `${name} is behind for ${count} ${count === 1 ? 'year' : 'years'}`,
  coachTitleYears: (n: number) => `Behind for ${n} ${n === 1 ? 'year' : 'years'}`,
  moveSubYear: (amount: string) => `${amount} a year fits what you save`,
  keepSubYear: (amount: string, pct: number | null) => `Raise to ${amount} a year${pct === null ? '' : ` (${pct}%)`}`,
}

export type GoalsFrequencyCopy = typeof EN

const AR: GoalsFrequencyCopy = {
  every: { monthly: 'كل شهر', quarterly: 'كل 3 أشهر', yearly: 'كل سنة' },
  amountPer: (amount, f) => (f === 'yearly' ? `${amount} في السنة` : f === 'quarterly' ? `${amount} كل 3 أشهر` : `${amount} في الشهر`),
  howOften: 'كل كم مرة',
  checkedMonthly: 'يُراجَع كل شهر.',
  checkedOnDue: (perMonth) => `يُراجَع في كل موعد استحقاق، فلا تظهر متأخرًا في الأشهر بينها. يُحسب كنحو ${perMonth} في الشهر في ميزانيتك.`,
  eachLabel: { monthly: 'كل شهر', quarterly: 'كل 3 أشهر', yearly: 'كل سنة' },
  behindBody: (name, count, move, raise) =>
    `${name} متأخر منذ ${arPlural(count, AR_YEAR)}.` +
    (move && raise ? ` انقل الموعد إلى ${move} أو أضف ${raise} في السنة.` : move ? ` انقل الموعد إلى ${move}.` : raise ? ` أضف ${raise} في السنة.` : ''),
  bannerBehind: (name, count) => `${name} متأخر منذ ${arPlural(count, AR_YEAR)}`,
  coachTitleYears: (n) => `متأخر منذ ${arPlural(n, AR_YEAR)}`,
  moveSubYear: (amount) => `${amount} في السنة يناسب ما تدّخره`,
  keepSubYear: (amount, pct) => `ارفعه إلى ${amount} في السنة${pct === null ? '' : ` (${pct}%)`}`,
}

export const GOALS_FREQUENCY_COPY: Record<Locale, GoalsFrequencyCopy> = { en: EN, ar: AR }
