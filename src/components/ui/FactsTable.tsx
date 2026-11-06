'use client'

import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'

export interface Fact {
  label: string
  value: ReactNode
  /** Colour of the value; defaults to text-primary. */
  valueTone?: string
  /** Second line under the value, e.g. "3 days after the payday". */
  sub?: ReactNode
  subTone?: string
  /** Sits in the row's empty middle, BEFORE the value, so the value never moves (e.g. Unlink). */
  trailing?: ReactNode
}

/**
 * Label → value rows in a bordered card, for detail sheets. With `onEdit`, a caps label and
 * a pencil sit directly above the table — the one way into editing the facts.
 */
export function FactsTable({
  rows,
  label,
  onEdit,
  editLabel,
}: {
  rows: Fact[]
  label?: string
  onEdit?: () => void
  editLabel?: string
}) {
  return (
    <>
      {label ? (
        <div className="-mb-2.5 -me-1.5 ms-0.5 flex items-center justify-between">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{label}</span>
          {onEdit && editLabel ? (
            <IconButton variant="ghost" size="sm" aria-label={editLabel} onClick={onEdit}>
              <Pencil className="size-[17px]" strokeWidth={1.75} />
            </IconButton>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={cn('flex min-h-11 items-center justify-between gap-3 px-3.5 py-[11px]', i > 0 && 'border-t border-[var(--color-brand-border)]')}
          >
            <span className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{r.label}</span>
            <span className="flex-1" />
            {r.trailing ? <span className="-my-2.5 me-1">{r.trailing}</span> : null}
            <span className="flex flex-col items-end gap-px text-end">
              <span className="text-[0.84375rem] font-semibold" style={{ color: r.valueTone ?? 'var(--color-brand-text-primary)' }}>
                {r.value}
              </span>
              {r.sub ? (
                <span className="text-xs font-semibold" style={{ color: r.subTone ?? 'var(--color-brand-text-secondary)' }}>
                  {r.sub}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
