'use client'

import { Check, GitCompare, History, Hammer, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { BudgetPlan } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useBudgetDeckCopy } from './useDeckCopy'

export interface PlanRailProps {
  plans: BudgetPlan[]
  activeId: string | null
  onActivate: (id: string) => void
  onContinue: (id: string) => void
  onCompare: () => void
  onNew: () => void
  onHistory: () => void
}

/** Desktop-only list of every budget with its one action, beside the plan. */
export function PlanRail({ plans, activeId, onActivate, onContinue, onCompare, onNew, onHistory }: PlanRailProps) {
  const c = useBudgetDeckCopy()
  return (
    <Card padding="md" className="hidden flex-col gap-1 lg:flex">
      <div className="flex items-center justify-between">
        <span className={microClassName}>{c.deck.title}</span>
        {plans.length > 1 ? (
          <Button size="sm" variant="ghost" onClick={onCompare}>
            <GitCompare aria-hidden />
            {c.compare.action}
          </Button>
        ) : null}
      </div>
      {plans.map((p) => {
        const active = p.id === activeId
        const draft = p.status === 'draft'
        return (
          <div key={p.id} className="flex min-h-[52px] items-center gap-3 rounded-xl px-2" data-active={active || undefined}>
            <span className="flex size-5 shrink-0 items-center justify-center text-[var(--color-brand-primary)]">
              {active ? <Check className="size-4" aria-hidden /> : draft ? <Hammer className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{p.name}</span>
              <span className="block text-xs text-[var(--color-brand-text-secondary)]">
                {active ? c.deck.active : draft ? c.deck.draft : c.deck.ready}
              </span>
            </span>
            {active ? null : (
              <Button size="touch" variant="ghost" onClick={() => (draft ? onContinue(p.id) : onActivate(p.id))}>
                {draft ? c.deck.continueBuilding : c.deck.setActive}
              </Button>
            )}
          </div>
        )
      })}
      <div className="mt-1 flex gap-2">
        <Button size="touch" variant="outline" className="flex-1" onClick={onNew}>
          <Plus aria-hidden />
          {c.deck.newPlan}
        </Button>
        <Button size="touch" variant="ghost" onClick={onHistory}>
          <History aria-hidden />
          {c.deck.history}
        </Button>
      </div>
    </Card>
  )
}
