'use client'

import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useBudgetStudioCopy } from '../useStudioCopy'
import type { KnownRow } from './KnownSheet'
import { StudioHeading } from './StudioHeading'

export interface UnderstoodStepProps {
  rows: KnownRow[]
  /** Lines the description held that do not apply yet, and why amounts were not used; shown, never hidden. */
  notes?: string[]
  onEdit: (id: string) => void
  onContinue: () => void
}

/** What Buddgy picked out of the description, before the remaining questions. Each line opens its answer to change it. */
export function UnderstoodStep({ rows, notes = [], onEdit, onContinue }: UnderstoodStepProps) {
  const c = useBudgetStudioCopy().opener
  return (
    <div className="flex flex-col gap-5">
      <StudioHeading mood="happy" label={c.kicker} title={c.understood(rows.length)} />
      {rows.length > 0 ? (
        <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">
          {rows.map((r) => (
            <Button
              key={r.id}
              variant="ghost"
              className="h-auto min-h-14 w-full justify-start gap-3 rounded-none px-4 py-3 text-start"
              aria-label={`${c.edit}: ${r.label}, ${r.value}`}
              onClick={() => onEdit(r.id)}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
                <Check className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block whitespace-normal text-sm font-normal text-[var(--color-brand-text-secondary)]">{r.label}</span>
                {r.note ? <span className="block whitespace-normal text-xs font-normal text-[var(--color-brand-text-muted)]">{r.note}</span> : null}
              </span>
              <span className="max-w-[45%] whitespace-normal text-end text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{r.value}</span>
              <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
            </Button>
          ))}
        </Card>
      ) : null}
      {notes.map((n) => (
        <p key={n} className="rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-3 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
          {n}
        </p>
      ))}
      <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.change}</p>
      <Button size="cta" className="w-full" onClick={onContinue}>
        {c.cont}
      </Button>
    </div>
  )
}
