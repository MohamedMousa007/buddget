'use client'

import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { Card } from '@/components/ui/card'
import { lineIconKey } from '@/lib/budget/lineIcons'
import type { LineView } from '@/lib/budget/planView.types'
import { formatCurrency } from '@/lib/utils/formatters'
import { capBar, planBar } from './geometry'
import { ActionButton, AddRow, BodyFrame, FlatCard, StatusLine, ThinBar, lineStatusIcon, useLineStatusText } from './parts'

const TRIMMED_BELOW = 0.97

function fillColor(kind: LineView['status']['kind']): string {
  if (kind === 'over' || kind === 'unbudgetedSpend') return 'var(--color-brand-red)'
  if (kind === 'near') return 'var(--color-brand-amber)'
  return 'var(--color-cat-5)'
}

/** Two-column category tiles. Plan: amount against the 3-month average. Month: spent against the cap. */
export function EverydayBlockBody({ view, block, mode, onOpenLine, onLineAction, onAdd }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const catLabel = useCategoryLabel()
  const statusText = useLineStatusText(view)
  const money = (n: number) => formatCurrency(n, view.base, false)
  const month = mode === 'month'

  return (
    <BodyFrame>
      <div className="grid grid-cols-2 gap-2.5">
        {block.lines.map((lv) => {
          const { status } = lv
          const cap = month ? capBar(lv.spent, lv.amount, lv.average) : null
          const plan = month ? null : planBar(lv.amount, lv.average)
          const hasAction = month && status.button.action !== 'none'
          const trimmed = lv.average != null && lv.amount < lv.average * TRIMMED_BELOW
          const Icon = lineStatusIcon(status.icon)
          return (
            <Card key={lv.line.id} padding="none" className="flex flex-col">
              <button type="button" onClick={() => onOpenLine(lv.line.id)} className="flex flex-1 flex-col gap-2 p-3 text-start">
                <span className="flex items-center gap-2">
                  <TintedTile cat={5} size="sm">
                    <LineIcon name={lineIconKey(lv.line.icon)} />
                  </TintedTile>
                  <span className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{catLabel(lv.line.name)}</span>
                </span>
                {month ? (
                  <span className="flex flex-col font-mono-numbers">
                    <span className="whitespace-nowrap text-lg font-semibold text-[var(--color-brand-text-primary)]">{money(lv.spent)}</span>
                    <span className="whitespace-nowrap text-xs text-[var(--color-brand-text-secondary)]">{t.everyday.ofCap(money(lv.amount))}</span>
                  </span>
                ) : (
                  <span className="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">{money(lv.amount)}</span>
                )}
                {cap ? (
                  <div className="relative h-2 rounded-full bg-[var(--color-brand-elevated)]" aria-hidden>
                    <div
                      className="absolute inset-y-0 end-0 rounded-e-full bg-[var(--color-brand-red)]/15"
                      style={{ insetInlineStart: `${cap.capAt}%` }}
                    />
                    <div className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${cap.fill}%`, background: fillColor(status.kind) }} />
                    {cap.tick != null ? (
                      <span
                        className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-[var(--color-brand-text-primary)] opacity-55"
                        style={{ insetInlineStart: `${cap.tick}%` }}
                      />
                    ) : null}
                  </div>
                ) : plan ? (
                  <ThinBar fill={plan.fill} tick={plan.tick} color="var(--color-cat-5)" />
                ) : null}
                {month ? (
                  <StatusLine tone={status.tone} icon={Icon}>{statusText(status)}</StatusLine>
                ) : status.kind !== 'ok' ? (
                  <StatusLine tone={status.tone} icon={Icon}>{statusText(status)}</StatusLine>
                ) : lv.average != null ? (
                  <span className="truncate font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
                    {t.everyday.avg(money(lv.average), trimmed)}
                  </span>
                ) : null}
              </button>
              {hasAction ? (
                <div className="px-3 pb-3">
                  <ActionButton
                    action={status.button.action}
                    variant={status.button.variant}
                    onClick={() => onLineAction(lv, status.button.action)}
                    className="w-full"
                  />
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>

      {month ? (
        <div className="mt-3 flex flex-wrap items-center gap-3.5 text-[0.6875rem] text-[var(--color-brand-text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 rounded-sm bg-[var(--color-brand-text-primary)] opacity-55" aria-hidden />
            {t.everyday.legendAvg}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3.5 rounded-full bg-[var(--color-brand-red)]/15" aria-hidden />
            {t.everyday.legendPast}
          </span>
        </div>
      ) : null}

      <FlatCard className="mt-3">
        <AddRow label={t.everyday.add} onClick={() => onAdd('everyday')} />
      </FlatCard>
    </BodyFrame>
  )
}
