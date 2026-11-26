'use client'

import { Calendar, Repeat, Sparkles, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BAND_FG2, BAND_MIX } from '@/components/features/hero/HeroBand'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import type { LearningProgress } from '@/lib/insights/analysis'
import { BAND_LABEL, InsightsBand } from './InsightsHero'
import { ToneTile, type Tone } from './InsightsParts'

const EXAMPLE_LOOK: { Icon: typeof TrendingUp; tone: Tone }[] = [
  { Icon: TrendingUp, tone: 'amber' },
  { Icon: Calendar, tone: 'teal' },
  { Icon: Repeat, tone: 'teal' },
]

/** Too little data to speak yet: progress towards enough days and purchases, then what the page will show. */
export function InsightsLearning({ progress }: { progress: LearningProgress }) {
  const c = useInsightsLtCopy().learning
  return (
    <>
      <InsightsBand>
        <span className={BAND_LABEL}>{c.label}</span>
        <p className="mt-2 flex items-center gap-2 text-[1.0625rem] font-semibold">
          <Sparkles aria-hidden className="size-5" />
          {c.title}
        </p>
        <p className={`mt-1 text-[0.8125rem] ${BAND_FG2}`}>{c.body(progress.daysMore)}</p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full"
          style={{ background: BAND_MIX }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.pct}
          aria-label={c.title}
        >
          <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${Math.max(4, progress.pct)}%` }} />
        </div>
        <p className={`mt-1.5 font-mono-numbers text-[0.6875rem] ${BAND_FG2}`}>
          {c.progress(progress.days, progress.daysNeeded, progress.purchases, progress.purchasesNeeded)}
        </p>
      </InsightsBand>

      <h2 className="px-1 pt-2 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{c.examplesTitle}</h2>
      <ul className="flex flex-col gap-2">
        {c.items.map((item, i) => {
          const { Icon, tone } = EXAMPLE_LOOK[i] ?? EXAMPLE_LOOK[0]
          return (
            <li key={item.title} className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] px-4 py-3">
              <ToneTile tone={tone}><Icon /></ToneTile>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">{item.title}</span>
                  <Badge tone="neutral" size="xs">{c.example}</Badge>
                </span>
                <span className="block text-xs text-[var(--color-brand-text-muted)]">{item.sub}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
