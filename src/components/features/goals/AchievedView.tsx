'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AchievedRow } from '@/components/features/goals/AchievedRow'
import { GoalGlyph } from '@/components/features/goals/GoalGlyph'
import { TrophyHero } from '@/components/features/goals/TrophyHero'
import type { GoalRow } from '@/hooks/useGoalRows'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { achievedFacts } from '@/lib/goals/achievedFacts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, Goal } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { formatWhole } from '@/lib/utils/formatters'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** Trophy room: a band hero with three facts, the finished goals newest first, and the goal closest to done. */
export function AchievedView({
  goals,
  base,
  rates,
  next,
  onOpen,
  onNewGoal,
}: {
  goals: Goal[]
  base: Currency
  rates: Record<string, number>
  /** The running goal closest to its target, nudged under the list. */
  next: GoalRow | null
  onOpen: (g: Goal) => void
  onNewGoal: () => void
}) {
  const t = useT().goals.achievedView
  const c = useGoalsLtCopy().goals
  const txs = useFinanceStore((s) => s.savingsTransactions)
  const facts = useMemo(() => achievedFacts(goals, txs), [goals, txs])
  const total = useMemo(() => goals.reduce((s, g) => s + convertCurrency(g.targetAmount ?? 0, g.currency, base, rates), 0), [goals, base, rates])

  return (
    <div className="flex flex-col gap-3.5">
      <TrophyHero
        stats={{ count: goals.length, totalLabel: formatWhole(total), currency: base, deposits: facts.deposits, fastestMonths: facts.fastestMonths, bestStreak: facts.bestStreak }}
      />
      <h2 className={`${microClassName} mt-2.5 px-1`}>{c.finishedNewest}</h2>
      <Card padding="none" divide className="overflow-hidden">
        {goals.map((g) => (
          <AchievedRow key={g.id} goal={g} deposits={facts.depositsByGoal[g.id] ?? 0} />
        ))}
      </Card>
      {next ? (
        <button
          type="button"
          onClick={() => onOpen(next.goal)}
          data-raw-button-ok="a goal card that opens the goal sheet"
          className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start"
        >
          <GoalGlyph goal={next.goal} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-[var(--color-brand-primary-ink)]">{c.nextToFinish}</span>
            <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.nextLine(next.goal.name, next.percent)}</span>
            <span className="mt-1.5 block h-1.5 rounded-full bg-[var(--color-brand-sunken)]">
              <span className="block h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${next.percent}%` }} />
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
        </button>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[var(--color-brand-border)] p-4">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.closingTitle(goals.length + 1)}</p>
          <Button size="cta-block" onClick={onNewGoal}>
            {t.setGoal}
          </Button>
        </div>
      )}
    </div>
  )
}
