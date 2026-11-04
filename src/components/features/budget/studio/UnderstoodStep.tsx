'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useBudgetStudioCopy } from '../useStudioCopy'
import type { KnownRow } from './KnownSheet'
import { StudioHeading } from './StudioHeading'

/** What Buddgy picked out of the description, before the remaining questions. */
export function UnderstoodStep({ rows, onContinue }: { rows: KnownRow[]; onContinue: () => void }) {
  const c = useBudgetStudioCopy().opener
  return (
    <div className="flex flex-col gap-5">
      <StudioHeading mood="happy" label={c.kicker} title={c.understood(rows.length)} />
      <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
              <Check className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-sm text-[var(--color-brand-text-secondary)]">{r.label}</span>
            <span className="max-w-[55%] text-end text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{r.value}</span>
          </div>
        ))}
      </Card>
      <p className="text-[13px] text-[var(--color-brand-text-secondary)]">{c.change}</p>
      <Button size="cta" className="w-full" onClick={onContinue}>
        {c.cont}
      </Button>
    </div>
  )
}
