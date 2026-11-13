'use client'

import { ChevronDown } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectableCard } from '@/components/ui/SelectableCard'
import type { PlanMode } from '@/lib/budget/planView.types'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface PlanBarProps {
  planName: string
  /** What the shown plan is: only the live one applies to every month. */
  state: 'active' | 'ready' | 'draft'
  mode: PlanMode
  onModeChange: (mode: PlanMode) => void
  /** Toggles the deck of budgets under the bar. */
  onOpenPlans: () => void
  expanded: boolean
}

/** Plan chip (the one entry to every plan action) and the Plan | Month switch. */
export function PlanBar({ planName, state, mode, onModeChange, onOpenPlans, expanded }: PlanBarProps) {
  const c = useBudgetChromeCopy().planBar
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SelectableCard
          as="action"
          layout="row"
          surface="card"
          onClick={onOpenPlans}
          aria-label={`${c.switchPlan}: ${planName}`}
          aria-expanded={expanded}
          className="h-14 min-w-0 flex-1 gap-3 px-3 py-0"
        >
          <span className={`size-2.5 shrink-0 rounded-full ${state === 'active' ? 'bg-[var(--color-brand-primary-bright)]' : 'bg-[var(--color-brand-text-muted)]'}`} aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[0.9375rem] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{planName}</span>
            <span className="truncate text-xs text-[var(--color-brand-text-secondary)]">{c[`${state}Sub`]}</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-[var(--color-brand-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </SelectableCard>
      </div>
      <SegmentedControl
        ariaLabel={c.modeLabel}
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'plan', label: c.plan },
          { value: 'month', label: c.month },
        ]}
      />
    </div>
  )
}
