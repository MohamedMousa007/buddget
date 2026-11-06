'use client'

import { Check, Clock } from 'lucide-react'
import { BrandTile } from '@/components/features/subscriptions/BrandTile'
import { Button } from '@/components/ui/button'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/formatters'
import { ActionButton, BodyFrame, FlatCard, StatusLine, lineStatusIcon, useLineStatusText } from './parts'

/** Linked block: logo tiles, next charges and a way into the Subscriptions page. No add CTA. */
export function SubscriptionsBlockBody({ view, block, mode, onOpenLine, onLineAction, onOpenLinked }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const { formatDayMonth } = useLocalizedFormatters()
  const statusText = useLineStatusText(view)
  const { items, next, left, charged, total, yearlySetAside } = view.extras.subscriptions
  const month = mode === 'month'
  const pending = new Set(left.map((c) => c.name))
  const brandOf = (name: string) => items.find((i) => i.name === name)?.brandKey ?? null
  const upcoming = month ? left.slice(0, 2) : next ? [next] : []
  const drifted = block.lines.find((l) => l.status.kind === 'drifted')

  return (
    <BodyFrame>
      <FlatCard className="flex flex-col gap-3 p-4">
        <button
          type="button"
          disabled={!block.lines[0]}
          onClick={() => block.lines[0] && onOpenLine(block.lines[0].line.id)}
          className="grid grid-cols-4 gap-2.5 text-start"
        >
          {items.map((item) => {
            const isPending = month && pending.has(item.name)
            return (
              <div key={item.id} className="flex flex-col items-center gap-1">
                <div
                  className={cn('relative', isPending && 'opacity-60')}
                  role="img"
                  aria-label={month ? (isPending ? t.subscriptions.upcoming(item.name) : t.subscriptions.charged(item.name)) : item.name}
                >
                  <BrandTile brandKey={item.brandKey} name={item.name} size={40} />
                  {month ? (
                    <span
                      className="absolute -end-[3px] -bottom-[3px] flex size-4 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] text-white"
                      style={{ background: isPending ? 'var(--color-brand-amber)' : 'var(--color-brand-green)' }}
                      aria-hidden
                    >
                      {isPending ? <Clock className="size-2.5" /> : <Check className="size-2.5" strokeWidth={3} />}
                    </span>
                  ) : null}
                </div>
                <span className="max-w-full truncate text-xs text-[var(--color-brand-text-secondary)]">{item.name}</span>
              </div>
            )
          })}
        </button>

        {upcoming.length > 0 ? (
          <div className="flex flex-col border-t border-[var(--color-brand-border)] pt-2">
            {upcoming.map((c, i) => (
              <div key={`${c.name}-${c.date}`} className="flex min-h-12 items-center gap-3">
                <BrandTile brandKey={brandOf(c.name)} name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.name}</p>
                  <p className="truncate text-xs text-[var(--color-brand-text-secondary)]">
                    {i === 0 ? t.subscriptions.nextCharge(formatDayMonth(c.date)) : t.subscriptions.thenCharge(formatDayMonth(c.date))}
                  </p>
                </div>
                <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
                  {formatCurrency(c.amount, view.base, false)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {yearlySetAside > 0 ? (
          <p className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
            {t.subscriptions.yearlySetAside(formatCurrency(yearlySetAside, view.base, false))}
          </p>
        ) : null}

        {drifted ? (
          <div className="flex items-center gap-2 border-t border-[var(--color-brand-border)] pt-2">
            <StatusLine tone={drifted.status.tone} icon={lineStatusIcon(drifted.status.icon)} className="flex-1">
              {statusText(drifted.status)}
            </StatusLine>
            <ActionButton
              action={drifted.status.button.action}
              variant={drifted.status.button.variant}
              onClick={() => onLineAction(drifted, drifted.status.button.action)}
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-[var(--color-brand-border)] pt-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            {month ? (
              <StatusLine tone="ok" icon={lineStatusIcon('check')}>
                {total > 0 && charged >= total ? t.subscriptions.allCharged : t.subscriptions.chargesLeft(Math.max(0, total - charged))}
              </StatusLine>
            ) : null}
          </div>
          <Button variant="ghost" size="touch" className="ms-auto" onClick={() => onOpenLinked('subscriptions')}>
            {t.subscriptions.manage}
          </Button>
        </div>
      </FlatCard>
    </BodyFrame>
  )
}
