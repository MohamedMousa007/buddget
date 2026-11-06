'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'

export type BudgetChipStatus =
  /** Covered by a plan row: the % used with a progress bar. */
  | { kind: 'budgeted'; pct: number }
  /** No budget covers it: "?" with a full warning bar (out of budget). */
  | { kind: 'unassigned' }

export interface BudgetChipProps {
  label: string
  icon: ReactNode
  status: BudgetChipStatus
  selected: boolean
  onToggle: () => void
  /** Accessible name; carries the state so colour is never the only cue. */
  ariaLabel: string
}

function barTone(status: BudgetChipStatus): string {
  if (status.kind === 'unassigned') return 'var(--color-brand-amber)'
  if (status.pct > 1) return 'var(--color-brand-red)'
  return status.pct >= 0.8 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)'
}

/**
 * A category in Flow's chip row once a budget plan exists: icon, name, and the budget state
 * stacked in one slot (the % over a 3px progress bar, or "?" over a full warning bar).
 * Tapping filters the ledger to the category; selected swaps the glyph for ✕ in place and is announced as pressed.
 */
export function BudgetChip({ label, icon, status, selected, onToggle, ariaLabel }: BudgetChipProps) {
  const fill = status.kind === 'unassigned' ? 1 : Math.min(1, status.pct)
  const over = status.kind === 'budgeted' && status.pct > 1
  return (
    <OptionChip as="trigger" surface="card" size="sm" selected={selected} aria-pressed={selected} aria-label={ariaLabel} onClick={onToggle}>
      {selected ? <X className="size-4" strokeWidth={2.5} aria-hidden /> : icon}
      {label}
      <span className="flex flex-col items-center gap-0.5">
        <span
          className="font-mono-numbers text-[0.6875rem] leading-none font-bold"
          style={{ color: over ? 'var(--color-brand-red)' : 'var(--color-brand-text-secondary)' }}
        >
          {status.kind === 'unassigned' ? '?' : `${Math.round(status.pct * 100)}%`}
        </span>
        <span aria-hidden className="h-[3px] w-6 overflow-hidden rounded-full" style={{ background: 'var(--color-brand-elevated)' }}>
          <span className="block h-full rounded-full" style={{ width: `${fill * 100}%`, background: barTone(status) }} />
        </span>
      </span>
    </OptionChip>
  )
}
