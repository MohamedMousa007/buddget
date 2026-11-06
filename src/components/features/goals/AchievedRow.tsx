import { Check } from 'lucide-react'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useLocale, useT } from '@/lib/i18n'
import { goalVisual } from '@/lib/goals/goalVisual'
import type { Goal } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'

function monthsBetween(a: string, b: string): number {
  const x = new Date(a)
  const y = new Date(b)
  return Math.max(1, (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()))
}

export const goalMonthsTaken = (g: Goal) => monthsBetween(g.createdAt, g.achievedAt ?? g.createdAt)
export const goalMonthsEarly = (g: Goal) =>
  g.targetDate && g.achievedAt && g.achievedAt.slice(0, 10) < g.targetDate
    ? Math.max(0, monthsBetween(g.achievedAt, g.targetDate))
    : 0

/** One finished goal in the trophy room. */
export function AchievedRow({ goal }: { goal: Goal }) {
  const t = useT().goals.achievedView
  const hidden = useMask('lists')
  const { locale } = useLocale()
  const { icon: Icon } = goalVisual(goal.category)
  const months = goalMonthsTaken(goal)
  const early = goalMonthsEarly(goal)
  const finished = goal.achievedAt
    ? new Date(goal.achievedAt).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5 shadow-sm">
      <span className="relative flex size-[52px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-brand-primary-bright)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
        <Icon className="size-6" aria-hidden />
        <span className="absolute -bottom-0.5 -end-0.5 flex size-5 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{goal.name}</p>
        {goal.targetAmount !== null ? (
          <p className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {hidden ? MASK : formatCurrency(goal.targetAmount, goal.currency, false)}
          </p>
        ) : null}
        <p className="text-xs font-semibold text-[var(--color-brand-primary-ink)]">
          {early > 0 ? t.early(months, early) : t.onTime(months)}
        </p>
      </div>
      <span className="font-mono-numbers text-[0.6875rem] text-[var(--color-brand-text-secondary)]">{finished}</span>
    </div>
  )
}
