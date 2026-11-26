'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useInsightsLtCopy, type InsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { track } from '@/lib/analytics/events'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatWhole } from '@/lib/utils/formatters'
import type { BuddgyRead as Read, ReadLine, ReadQuestion } from '@/lib/insights/narrative'
import { Emphasis, InsightsSection } from './InsightsParts'

function lineText(l: ReadLine, c: InsightsLtCopy['read'], money: (n: number) => string, cat: (raw: string) => string): string {
  switch (l.key) {
    case 'paceBudget': return c.paceBudget({ daily: money(l.dailyRate), delta: money(l.delta), over: l.over, far: l.far })
    case 'paceUsual': return c.paceUsual({ daily: money(l.dailyRate), delta: money(l.delta), more: l.more })
    case 'paceProjection': return c.paceProjection({ daily: money(l.dailyRate), projected: money(l.projected) })
    case 'early': return c.early({ spent: money(l.spent), daysMore: l.daysMore })
    case 'driverShift': return c.driverShift({ name: cat(l.name), pct: l.pct, up: l.up })
    case 'driverTop': return c.driverTop({ name: cat(l.name), share: l.share })
    case 'driverUnusual': return c.driverUnusual({ description: l.description, amount: money(l.amount) })
    case 'bills': return c.bills({ count: l.count, total: money(l.total) })
    case 'actionLand': return c.actionLand({ daily: money(l.landDaily) })
    case 'actionNothingLeft': return c.actionNothingLeft
    case 'actionKeep': return c.actionKeep({ delta: money(l.delta) })
  }
}

function question(q: ReadQuestion, c: InsightsLtCopy['read'], cat: (raw: string) => string) {
  if (q.key === 'whyCategory') return { label: c.q.whyCategory.label(cat(q.name)), seed: c.q.whyCategory.seed(cat(q.name)) }
  return c.q[q.key]
}

/** Pro: Buddgy's read of the month in plain words, composed on the device from the findings, with two questions to ask. */
export function BuddgyReadCard({ read, month }: { read: Read; month: string }) {
  const t = useT()
  const c = useInsightsLtCopy().read
  const hidden = useMask('lists')
  const cat = (raw: string) => categoryLabel(t, raw)
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  const text = read.lines.map((l) => lineText(l, c, money, cat)).join(' ')
  return (
    <section
      className="rounded-2xl p-[1.5px]"
      style={{ background: 'linear-gradient(120deg, var(--color-brand-primary), color-mix(in oklab, var(--color-brand-primary) 30%, var(--color-brand-amber)))' }}
    >
      <div className="rounded-[15px] bg-[var(--color-brand-card)] p-4">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-brand-primary-ink)]">
          <Sparkles aria-hidden className="size-4" />
          {c.title(month)}
        </h3>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-brand-text-primary)]">
          <Emphasis text={text} />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {read.questions.map((q) => {
            const { label, seed } = question(q, c, cat)
            return (
              <OptionChip
                key={q.key}
                as="trigger"
                surface="card"
                onClick={() => {
                  track('insights.read_ask', { question: q.key })
                  useSettingsStore.getState().openAiChatWithSeed(seed, true)
                }}
              >
                {label}
              </OptionChip>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Free: what Buddgy's read would do, and the way to Pro. */
export function ExplainMonthCard({ onSeePro }: { onSeePro: () => void }) {
  const t = useT()
  const c = useInsightsLtCopy().read
  return (
    <InsightsSection title={<><Sparkles aria-hidden className="size-4 text-[var(--color-brand-primary-ink)]" />{c.freeTitle}</>}>
      <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.freeBody}</p>
      <Button size="cta-block" variant="outline" className="mt-3" onClick={onSeePro}>
        {t.insights.seePro}
      </Button>
    </InsightsSection>
  )
}
