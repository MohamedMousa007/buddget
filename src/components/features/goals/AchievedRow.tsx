import { Check } from 'lucide-react'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useLocale } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { GoalGlyph } from '@/components/features/goals/GoalGlyph'
import { monthsTaken } from '@/lib/goals/achievedFacts'
import type { Goal } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'

/** One finished goal in the trophy room: its icon with a check, when it was reached, how long and how many deposits. */
export function AchievedRow({ goal, deposits }: { goal: Goal; deposits: number }) {
  const c = useGoalsLtCopy().goals
  const hidden = useMask('lists')
  const { locale } = useLocale()
  const reached = goal.achievedAt
    ? new Date(goal.achievedAt).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
    : ''
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="relative shrink-0">
        <GoalGlyph goal={goal} size={44} />
        <span aria-hidden className="absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]">
          <Check className="size-3" strokeWidth={3} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{goal.name}</span>
        <span className="block text-xs text-[var(--color-brand-text-muted)]">{c.reachedLine(reached, monthsTaken(goal), deposits)}</span>
      </span>
      {goal.targetAmount !== null ? (
        <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
          {hidden ? MASK : formatWhole(goal.targetAmount)}
        </span>
      ) : null}
    </div>
  )
}
