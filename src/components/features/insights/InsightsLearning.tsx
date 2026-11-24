'use client'

import { Card } from '@/components/ui/card'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useT } from '@/lib/i18n'

/** Shown instead of an empty feed while there is not enough data to say anything sure. */
export function InsightsLearning({ daysMore, totalDays }: { daysMore: number; totalDays: number }) {
  const c = useT().insights
  const pct = Math.max(8, Math.min(100, Math.round(((totalDays - daysMore) / totalDays) * 100)))
  return (
    <div className="space-y-2.5">
    <Card padding="md" className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
        <BuddgyIcon size={26} mood="curious" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{c.learningTitle}</p>
        <p className="mt-0.5 text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]">{c.learningBody(daysMore)}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]" role="presentation">
          <div className="h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Card>
    <p className="px-1 pt-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{c.previewTitle}</p>
    {c.previewItems.map((line) => (
      <Card key={line} padding="md" variant="elevated" className="flex items-center gap-2.5" aria-label={`${c.previewExample}: ${line}`}>
        <span className="shrink-0 rounded-md bg-[var(--color-brand-sunken)] px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-[var(--color-brand-text-secondary)]">{c.previewExample}</span>
        <span className="text-sm text-[var(--color-brand-text-secondary)]">{line}</span>
      </Card>
    ))}
    </div>
  )
}
