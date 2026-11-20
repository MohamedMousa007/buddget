'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BudgetChapter } from '@/lib/budget/blocks'
import type { ChatPlan } from '@/lib/buddgy/plan/chatPlan'
import { chatPreview, summarize } from '@/lib/buddgy/plan/planSummary'
import { useBuddgyPlanCopy } from '@/lib/i18n/buddgyPlanCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'

const CHAPTER_TONE: Record<BudgetChapter, string> = {
  mustPay: 'var(--color-brand-primary)',
  live: 'var(--color-brand-amber)',
  secure: 'var(--color-brand-green)',
}

export interface PlanReadyCardProps {
  plan: ChatPlan
  handed: boolean
  onReview: () => void
  onChange: () => void
}

/** The plan the builder's engine makes from the answers, with nothing saved; review and saving happen in the builder. */
export function PlanReadyCard({ plan, handed, onReview, onChange }: PlanReadyCardProps) {
  const copy = useBuddgyPlanCopy().ready
  // Once handed over, the builder has made its records: a preview from the store now would count them twice.
  if (handed) {
    return (
      <p role="status" dir="auto" className="flex min-h-14 w-full items-center gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 text-[0.84375rem] text-[var(--color-brand-text-secondary)]">
        <Check aria-hidden className="size-4 shrink-0 text-[var(--color-brand-green)]" />
        {copy.handed}
      </p>
    )
  }
  return <ReadySummary plan={plan} onReview={onReview} onChange={onChange} />
}

function ReadySummary({ plan, onReview, onChange }: Omit<PlanReadyCardProps, 'handed'>) {
  const copy = useBuddgyPlanCopy().ready
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const sum = useMemo(() => summarize(chatPreview(useFinanceStore.getState(), plan)), [plan])
  const money = (n: number) => formatCurrency(n, base, false)
  return (
    <div className="flex w-full flex-col gap-2">
      <p dir="auto" className="max-w-full rounded-2xl rounded-es-md bg-[var(--color-brand-elevated)] px-4 py-2.5 text-sm text-[var(--color-brand-text-primary)]">{copy.lead}</p>
      <section aria-label={copy.title} className="overflow-hidden rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-sm">
        <div className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <span dir="auto" className="font-semibold text-[var(--color-brand-text-primary)]">{copy.title}</span>
            <span className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{money(sum.income)}</span>
          </div>
          <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {sum.chapters.map((c) => <span key={c.key} style={{ width: `${c.percent}%`, background: CHAPTER_TONE[c.key] }} />)}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-[var(--color-brand-text-secondary)]">
            {sum.chapters.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: CHAPTER_TONE[c.key] }} />
                <span dir="auto">{copy.chapters[c.key]}</span>
                <span className="font-mono-numbers">{c.percent}%</span>
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-[var(--color-brand-border)] px-3.5 py-1.5">
          {sum.top.map((l) => (
            <div key={l.name} className="flex min-h-[30px] items-center justify-between gap-2">
              <span dir="auto" className="min-w-0 truncate text-[var(--color-brand-text-primary)]">{l.name}</span>
              <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{money(l.amount)}</span>
            </div>
          ))}
          {sum.rest.count > 0 ? (
            <div className="flex min-h-[30px] items-center justify-between gap-2 text-[var(--color-brand-text-secondary)]">
              <span dir="auto">{copy.more(sum.rest.count)}</span>
              <span className="font-mono-numbers">{money(sum.rest.amount)}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 border-t border-[var(--color-brand-border)] p-3.5">
          <Button size="cta-block" onClick={onReview}>{copy.review}</Button>
          <Button variant="ghost" size="touch" onClick={onChange}>{copy.change}</Button>
        </div>
      </section>
      <p dir="auto" className="px-1 text-xs text-[var(--color-brand-text-muted)]">{copy.note}</p>
    </div>
  )
}
