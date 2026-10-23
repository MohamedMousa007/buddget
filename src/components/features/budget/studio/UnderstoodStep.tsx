'use client'

import { Check } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useBudgetStudioCopy } from '../useStudioCopy'
import type { KnownRow } from './KnownSheet'

/** What Buddgy picked out of the description, before the remaining questions. */
export function UnderstoodStep({ rows, onContinue }: { rows: KnownRow[]; onContinue: () => void }) {
  const c = useBudgetStudioCopy().opener
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-3">
        <BuddgyIcon mood="happy" size={44} />
        <p className={`${microClassName} pb-1`}>{c.kicker}</p>
      </div>
      <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.understood(rows.length)}</h1>
      <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <Check className="size-4 shrink-0 text-[var(--color-brand-green)]" aria-hidden />
            <span className="min-w-0 flex-1 text-sm text-[var(--color-brand-text-secondary)]">{r.label}</span>
            <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.value}</span>
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
