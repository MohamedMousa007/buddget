'use client'

import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import type { SavingsType } from '@/lib/store/types'
import { cn } from '@/lib/utils'

const pillClass = (selected: boolean) =>
  cn(
    'flex min-w-32 items-center gap-2 rounded-md border px-4 py-2.5 text-left text-sm font-medium transition-colors',
    selected
      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
  )

/**
 * Fixed-size type pills for add/edit savings sheets.
 */
export function SavingsProductTypePicker({
  types,
  value,
  labels,
  onSelect,
}: {
  types: readonly SavingsType[]
  value: SavingsType
  labels: Record<SavingsType, string>
  onSelect: (st: SavingsType) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((st) => (
        <button key={st} type="button" onClick={() => onSelect(st)} className={pillClass(value === st)}>
          <SavingsAccountIcon account={{ type: st, icon: SAVINGS_TYPE_ICONS[st] }} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 leading-tight">{labels[st]}</span>
        </button>
      ))}
    </div>
  )
}
