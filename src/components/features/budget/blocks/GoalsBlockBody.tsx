'use client'

import { Clock } from 'lucide-react'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { CheckpointBar, type CheckpointTone } from '@/components/features/goals/CheckpointBar'
import { GoalStatusLine } from '@/components/features/goals/GoalStatusLine'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/types'
import type { GoalStatusView } from '@/lib/goals/goalStatus'
import { formatCurrency } from '@/lib/utils/formatters'
import { cycleCloseDate, toIsoDate } from './geometry'
import { BodyFrame, StatusLine } from './parts'

type Home = Dictionary['goals']['home']

const TONE: Record<string, CheckpointTone> = { over: 'over', behind: 'behind', paused: 'paused' }
const PERCENT_COLOR: Record<string, string> = {
  over: 'var(--color-brand-red-text)',
  behind: 'var(--color-brand-amber)',
  paused: 'var(--color-brand-text-secondary)',
}
const TILE_CATS = [5, 4, 2, 1, 3, 6] as const

function goalStatusLabel(v: GoalStatusView, t: Home, money: (n: number) => string): string {
  switch (v.kind) {
    case 'over': return t.statusOver(money(v.params.amount ?? 0))
    case 'underLimit': return t.statusLeft(money(v.params.amount ?? 0))
    case 'due': return (v.params.count ?? 0) < 0 ? t.statusOverdue : t.statusDue(v.params.count ?? 0)
    case 'behind': return t.statusBehind(v.params.count ?? 1, false)
    case 'oneDeposit': return t.statusOneDeposit
    case 'streak': return t.statusStreak(v.params.count ?? 3, false)
    case 'paused': return t.statusPaused
    case 'next': return t.statusNext(v.params.pct ?? 25, money(v.params.toGo ?? 0))
  }
}

/** One compact goals-style card per funded goal. Read-only: everything opens the Goals page. */
export function GoalsBlockBody({ view, mode, onOpenLinked }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const home = useT().goals.home
  const { formatMonthShort, formatDayMonth } = useLocalizedFormatters()
  const money = (n: number) => formatCurrency(n, view.base, false)
  const month = mode === 'month'
  const close = formatDayMonth(toIsoDate(cycleCloseDate(new Date(), view.dayOfCycle, view.daysInCycle)))
  const { goals } = view.extras

  return (
    <BodyFrame className="flex flex-col gap-3">
      {goals.length === 0 ? (
        <Card padding="md" className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm text-[var(--color-brand-text-secondary)]">{t.goals.empty}</span>
          <Button variant="ghost" size="touch" onClick={() => onOpenLinked('goals')}>{t.goals.open}</Button>
        </Card>
      ) : null}
      {goals.map((g, i) => (
        <Card key={g.id} padding="md" className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <TintedTile cat={TILE_CATS[i % TILE_CATS.length]} size={44}>
              <LineIcon name={g.icon} />
            </TintedTile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{g.name}</p>
              {g.targetDate ? (
                <p className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{formatMonthShort(g.targetDate.slice(0, 7))}</p>
              ) : null}
            </div>
            <span className="font-mono-numbers text-lg font-semibold" style={{ color: PERCENT_COLOR[g.status.kind] ?? 'var(--color-brand-text-primary)' }}>
              {Math.round(g.percent)}%
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 font-mono-numbers">
            <span className="text-[22px] leading-6 font-semibold text-[var(--color-brand-text-primary)]">{money(g.current)}</span>
            {g.target != null ? <span className="text-[13px] text-[var(--color-brand-text-secondary)]">{t.goals.ofTarget(money(g.target))}</span> : null}
            <span className="ms-auto text-[13px] font-semibold">
              {month ? (
                <StatusLine tone="pri" icon={Clock} className="font-mono-numbers text-[13px] font-semibold">{t.goals.atClose(money(g.monthly), close)}</StatusLine>
              ) : (
                <span className="text-[var(--color-brand-text-primary)]">{t.goals.perMonth(money(g.monthly))}</span>
              )}
            </span>
          </div>

          <CheckpointBar percent={g.percent} tone={TONE[g.status.kind] ?? 'default'} />

          <div className="flex items-center gap-2 border-t border-[var(--color-brand-border)] pt-2.5">
            <GoalStatusLine view={g.status} text={goalStatusLabel(g.status, home, money)} />
            <Button size="touch" variant={g.status.button.variant} onClick={() => onOpenLinked('goals')}>
              {t.goals.open}
            </Button>
          </div>
        </Card>
      ))}
    </BodyFrame>
  )
}
