import { cn } from '@/lib/utils'

export interface TimelineStep {
  key: string
  title: string
  sub: string
  amount: string
  tone: 'ok' | 'plain' | 'gap'
}

/** Dot-and-line history: bank-confirmed points in teal, the unexplained stretch dashed in amber. */
export function GapTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        const next = steps[i + 1]
        const lineAmber = s.tone === 'gap' || next?.tone === 'gap'
        return (
          <li key={s.key} className="flex gap-3.5">
            <span className="flex w-3.5 shrink-0 flex-col items-center" aria-hidden>
              <span className={cn('mt-1 size-3 rounded-full', s.tone === 'ok' && 'bg-[var(--color-brand-primary)]', s.tone === 'plain' && 'bg-[var(--color-brand-border-strong)]', s.tone === 'gap' && 'border-2 border-dashed border-[var(--color-brand-amber)]')} />
              {!last ? <span className={cn('mt-0.5 w-0.5 flex-1', lineAmber ? 'bg-[var(--color-brand-amber)]' : 'bg-[var(--color-brand-border-strong)]')} /> : null}
            </span>
            <div className={cn('min-w-0 flex-1', !last && 'pb-3.5')}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('text-[0.9375rem] font-semibold', s.tone === 'gap' ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-primary)]')}>{s.title}</span>
                <span className={cn('font-mono-numbers text-sm', s.tone === 'gap' ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-primary)]')}>{s.amount}</span>
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-[var(--color-brand-text-muted)]">{s.sub}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
