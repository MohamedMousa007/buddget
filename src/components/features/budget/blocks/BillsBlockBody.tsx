'use client'

import { useMemo } from 'react'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { AddRow, BodyFrame, FlatCard, LineRow } from './parts'
import { railDots, railPosition } from './geometry'

/** Month rail with a dot per due day and the payday marker, then one row per bill. */
export function BillsBlockBody({ view, block, mode, onOpenLine, onLineAction, onAdd }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const dots = useMemo(() => railDots(block.lines.map((l) => ({ dueDay: l.dueDay, paid: l.paid })), view.daysInCycle), [block.lines, view.daysInCycle])
  const { paydayDay } = view.extras
  const today = mode === 'month' ? view.dayOfCycle : null

  return (
    <BodyFrame>
      <FlatCard divide>
        {dots.length > 0 || paydayDay != null ? (
          <div className="px-3.5 pt-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{t.bills.railTitle}</p>
            <div role="img" aria-label={t.bills.railAria} className="relative mx-1.5 mt-1 mb-1.5 h-11">
              <div className="absolute inset-x-0 top-3 h-0.5 rounded-sm bg-[var(--color-brand-border-strong)]" />
              {dots.map((d) => {
                const filled = mode === 'plan' || d.paid
                return (
                  <span key={d.day}>
                    <i
                      className="absolute top-1.5 size-3.5 -translate-x-1/2 rounded-full border-[3px] border-[var(--color-cat-4)] rtl:translate-x-1/2"
                      style={{ insetInlineStart: `${d.left}%`, background: filled ? 'var(--color-cat-4)' : 'var(--color-brand-card)' }}
                    />
                    <span
                      className="absolute top-[26px] -translate-x-1/2 font-mono-numbers text-[10.5px] font-semibold text-[var(--color-brand-text-muted)] rtl:translate-x-1/2"
                      style={{ insetInlineStart: `${d.left}%` }}
                    >
                      {d.day}
                    </span>
                  </span>
                )
              })}
              {paydayDay != null ? (
                <span key="payday">
                  <i
                    className="absolute top-1.5 size-3.5 -translate-x-1/2 rounded-full border-[3px] border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] rtl:translate-x-1/2"
                    style={{ insetInlineStart: `${railPosition(paydayDay, view.daysInCycle)}%` }}
                  />
                  <span
                    className="absolute top-[26px] -translate-x-1/2 whitespace-nowrap font-mono-numbers text-[10.5px] font-semibold text-[var(--color-brand-primary-ink)] rtl:translate-x-1/2"
                    style={{ insetInlineStart: `${railPosition(paydayDay, view.daysInCycle)}%` }}
                  >
                    {t.bills.payday(paydayDay)}
                  </span>
                </span>
              ) : null}
              {today != null ? (
                <i
                  className="absolute top-2 size-2.5 -translate-x-1/2 rounded-full bg-[var(--color-brand-text-primary)] rtl:translate-x-1/2"
                  style={{ insetInlineStart: `${railPosition(today, view.daysInCycle)}%` }}
                  title={t.bills.today(today)}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="divide-y divide-[var(--color-brand-border)]">
          {block.lines.map((lv) => (
            <LineRow
              key={lv.line.id}
              view={view}
              lv={lv}
              mode={mode}
              sub={lv.dueDay != null ? t.bills.dueOn(lv.dueDay) : undefined}
              onOpen={() => onOpenLine(lv.line.id)}
              onAction={(a) => onLineAction(lv, a)}
            />
          ))}
          <AddRow label={t.bills.add} onClick={() => onAdd('bills')} />
        </div>
      </FlatCard>
    </BodyFrame>
  )
}
