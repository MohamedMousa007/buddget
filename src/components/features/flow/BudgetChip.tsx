'use client'

import { X } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'

const R = 5.5
const C = 2 * Math.PI * R

export interface BudgetChipProps {
  label: string
  /** Spent ÷ budget, 0–∞ (1.23 = 123%). */
  pct: number
  over: boolean
  selected: boolean
  onToggle: () => void
  /** Accessible name — "Show only Groceries" / "Remove Groceries filter". */
  ariaLabel: string
}

/**
 * A category budget in Flow's chip row: a 14px progress ring, the name and its %. Tapping
 * filters the ledger to that category (single-select from the row); selected shows fill,
 * border and ✕ and is announced as pressed.
 */
export function BudgetChip({ label, pct, over, selected, onToggle, ariaLabel }: BudgetChipProps) {
  const ring = over ? 'var(--color-brand-red)' : 'var(--color-brand-primary)'
  return (
    <OptionChip as="trigger" surface="card" size="sm" selected={selected} aria-pressed={selected} aria-label={ariaLabel} onClick={onToggle}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="size-3.5">
        <circle cx="7" cy="7" r={R} fill="none" stroke="var(--color-brand-elevated)" strokeWidth="2.5" />
        <circle
          cx="7"
          cy="7"
          r={R}
          fill="none"
          stroke={ring}
          strokeWidth="2.5"
          strokeDasharray={`${(Math.min(1, pct) * C).toFixed(2)} ${C.toFixed(2)}`}
          transform="rotate(-90 7 7)"
        />
      </svg>
      {label}
      <span
        className="font-mono-numbers text-[11px] font-bold"
        style={{ color: over ? 'var(--color-brand-red)' : 'var(--color-brand-text-secondary)' }}
      >
        {Math.round(pct * 100)}%
      </span>
      {selected ? <X className="size-3" strokeWidth={2.5} aria-hidden /> : null}
    </OptionChip>
  )
}
