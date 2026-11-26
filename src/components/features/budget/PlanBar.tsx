'use client'

import { ChevronDown } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { PlanMode } from '@/lib/budget/planView.types'
import { useBudgetLtCopy } from '@/lib/i18n/budgetLtCopy'
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
  /** Draw the plan picker row above the switch (default). Off when the page puts it elsewhere (`PlanPickerRow`). */
  picker?: boolean
}

/**
 * Light touch `page-budget`: the Month | Plan switch across the full width, optionally under the plan picker row.
 */
export function PlanBar({ planName, state, mode, onModeChange, onOpenPlans, expanded, picker = true }: PlanBarProps) {
  const c = useBudgetChromeCopy().planBar
  return (
    <div className="flex flex-col gap-2">
      {picker ? <PlanPickerRow planName={planName} state={state} onOpenPlans={onOpenPlans} expanded={expanded} /> : null}
      <SegmentedControl
        ariaLabel={c.modeLabel}
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'month', label: c.month },
          { value: 'plan', label: c.plan },
        ]}
      />
    </div>
  )
}

/** The plan picker as a quiet row: the one entry to every plan action (switch, new, compare, history). */
export function PlanPickerRow({ planName, state, onOpenPlans, expanded, className }: Pick<PlanBarProps, 'planName' | 'state' | 'onOpenPlans' | 'expanded'> & { className?: string }) {
  const c = useBudgetChromeCopy().planBar
  const lt = useBudgetLtCopy()
  return (
    <button
      type="button"
      onClick={onOpenPlans}
      aria-label={`${c.switchPlan}: ${planName}`}
      aria-expanded={expanded}
      className={`-mx-1 flex min-h-11 items-center gap-2 self-start rounded-xl px-1 text-start transition-colors hover:bg-[var(--color-brand-elevated)] ${className ?? ''}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${state === 'active' ? 'bg-[var(--color-brand-primary-bright)]' : 'bg-[var(--color-brand-text-muted)]'}`} aria-hidden />
      <span dir="auto" className="min-w-0 truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">{planName}</span>
      <span className="shrink-0 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">· {lt.planState[state]}</span>
      <ChevronDown className={`size-4 shrink-0 text-[var(--color-brand-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  )
}
