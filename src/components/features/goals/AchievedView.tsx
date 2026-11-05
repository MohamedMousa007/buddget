'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { AchievedRow, goalMonthsEarly, goalMonthsTaken } from '@/components/features/goals/AchievedRow'
import { TrophyHero } from '@/components/features/goals/TrophyHero'
import { useT } from '@/lib/i18n'
import type { Currency, Goal } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** Trophy room: hero totals, the list of wins, and a nudge toward the next goal. */
export function AchievedView({
  goals,
  base,
  rates,
  onNewGoal,
}: {
  goals: Goal[]
  base: Currency
  rates: Record<string, number>
  onNewGoal: () => void
}) {
  const t = useT().goals.achievedView
  const stats = useMemo(() => {
    const total = goals.reduce((s, g) => s + convertCurrency(g.targetAmount ?? 0, g.currency, base, rates), 0)
    const months = goals.map(goalMonthsTaken)
    return {
      count: goals.length,
      totalLabel: formatCurrency(total, base, false),
      avgMonths: months.length ? Math.round(months.reduce((a, b) => a + b, 0) / months.length) : 0,
      early: goals.filter((g) => goalMonthsEarly(g) > 0).length,
      checkpoints: goals.length * 4,
    }
  }, [goals, base, rates])

  return (
    <div className="flex flex-col gap-3.5">
      <TrophyHero stats={stats} />
      <h2 className={microClassName}>{t.yourWins}</h2>
      {goals.map((g) => (
        <AchievedRow key={g.id} goal={g} />
      ))}
      <div className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[var(--color-brand-border)] p-4">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.closingTitle(goals.length + 1)}</p>
        <Button size="cta-block" onClick={onNewGoal}>
          {t.setGoal}
        </Button>
      </div>
    </div>
  )
}
