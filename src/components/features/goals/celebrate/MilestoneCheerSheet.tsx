'use client'

import { Badge } from '@/components/ui/badge'
import { Flame, Flag } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useGoalAllocationRuns } from '@/hooks/useGoalAllocationRuns'
import { useT } from '@/lib/i18n'
import { getGoalStatus } from '@/lib/goals/goalStatus'
import type { Goal } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

/** Bottom sheet shown when a goal crosses 25, 50 or 75%. */
export function MilestoneCheerSheet({ goal, pct, current, onClose }: { goal: Goal; pct: number; current: number; onClose: () => void }) {
  const t = useT().goals.celebrate
  const runs = useGoalAllocationRuns()[goal.id] ?? []
  const status = getGoalStatus({ goal, current, runs, now: new Date() })
  const next = [25, 50, 75, 100].find((p) => p > pct)
  return (
    <ModalShell open onBackdropClick={onClose} padContent>
      <div className="flex flex-col items-center gap-4 pb-4 pt-2 text-center">
        <ProgressRing pct={pct} size={120} stroke={10} arc="var(--color-brand-primary-bright)" track="var(--color-brand-elevated)">
          <span className="font-mono-numbers text-[30px] font-bold text-[var(--color-brand-text-primary)]">{pct}%</span>
        </ProgressRing>
        <V3SheetHeader.DialogTitle>{t.cheerTitle(pct)}</V3SheetHeader.DialogTitle>
        <p className="max-w-xs text-sm leading-normal text-[var(--color-brand-text-secondary)]">
          {t.cheerBody(goal.name, formatCurrency(current, goal.currency, false))}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {status.kind === 'streak' ? (
            <Badge tone="ink" size="md" bordered={false} className="gap-1.5">
              <Flame className="size-3.5 text-[var(--color-brand-amber)]" aria-hidden />
              {t.streakChip(status.params.count ?? 3)}
            </Badge>
          ) : null}
          {next ? (
            <Badge tone="ink" size="md" bordered={false} className="gap-1.5">
              <Flag className="size-3.5 text-[var(--color-brand-primary-ink)]" aria-hidden />
              {t.nextChip(next)}
            </Badge>
          ) : null}
        </div>
        <Button size="cta-block" onClick={onClose}>
          {t.keepGoing}
        </Button>
      </div>
    </ModalShell>
  )
}
