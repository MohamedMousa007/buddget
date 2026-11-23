'use client'

import { Card } from '@/components/ui/card'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useT } from '@/lib/i18n'

/** Shown instead of an empty feed while there is not enough data to say anything sure. */
export function InsightsLearning({ daysMore, totalDays }: { daysMore: number; totalDays: number }) {
  const c = useT().insights
  const pct = Math.max(8, Math.min(100, Math.round(((totalDays - daysMore) / totalDays) * 100)))
  return (
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
  )
}
