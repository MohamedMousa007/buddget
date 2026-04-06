'use client'

import { useState } from 'react'
import { ChevronDown, Home, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SharedPlanSummary } from '@/hooks/useSharedBudgets'

export interface PlanSwitcherLabels {
  personal: string
  createShared: string
  defaultBadge: string
}

export interface PlanSwitcherProps {
  sharedPlans: SharedPlanSummary[]
  activeSharedId: string | null
  defaultSharedId: string | null
  labels: PlanSwitcherLabels
  onSelectPersonal: () => void
  onSelectShared: (planId: string) => void
  onCreateShared: () => void
}

/**
 * Switch between personal finance scope and shared household budgets.
 */
export function PlanSwitcher({
  sharedPlans,
  activeSharedId,
  defaultSharedId,
  labels,
  onSelectPersonal,
  onSelectShared,
  onCreateShared,
}: PlanSwitcherProps) {
  const [open, setOpen] = useState(false)

  const currentLabel =
    activeSharedId ?
      (sharedPlans.find((p) => p.id === activeSharedId)?.name ?? 'Shared')
    : labels.personal

  return (
    <div className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3 text-left text-sm font-medium text-white sm:min-w-[220px]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-2 min-w-0">
          {activeSharedId ?
            <Users className="h-4 w-4 shrink-0 text-[var(--color-brand-red)]" />
          : <Home className="h-4 w-4 shrink-0 text-[var(--color-brand-red)]" />}
          <span className="truncate">{currentLabel}</span>
          {activeSharedId && defaultSharedId === activeSharedId ?
            <span className="shrink-0 rounded-md bg-[var(--color-brand-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-brand-text-muted)]">
              {labels.defaultBadge}
            </span>
          : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open ? 'rotate-180' : '')} />
      </button>
      {open ?
        <ul
          className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-1 shadow-lg"
          role="listbox"
        >
          <li>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-[var(--color-brand-elevated)]"
              onClick={() => {
                onSelectPersonal()
                setOpen(false)
              }}
            >
              <Home className="h-4 w-4" />
              {labels.personal}
            </button>
          </li>
          {sharedPlans.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--color-brand-elevated)]',
                  activeSharedId === p.id ? 'text-[var(--color-brand-red)]' : 'text-white'
                )}
                onClick={() => {
                  onSelectShared(p.id)
                  setOpen(false)
                }}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-[var(--color-brand-border)]">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-sm text-[var(--color-brand-red)] hover:bg-[var(--color-brand-elevated)]"
              onClick={() => {
                onCreateShared()
                setOpen(false)
              }}
            >
              + {labels.createShared}
            </button>
          </li>
        </ul>
      : null}
    </div>
  )
}
