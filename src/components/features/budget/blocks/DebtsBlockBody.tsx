'use client'

import { Clock, Flag, TriangleAlert } from 'lucide-react'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import type { DebtExtras } from '@/lib/budget/planView.types'
import { formatCurrency } from '@/lib/utils/formatters'
import { ActionButton, AddRow, BodyFrame, FlatCard, LineRow, StatusLine, ThinBar, lineStatusIcon } from './parts'

const DEBT_ICON: Record<DebtExtras['kind'], string> = {
  credit_card: 'credit-card',
  installment: 'credit-card',
  loan: 'landmark',
  personal: 'hand-coins',
}

/** One row per linked debt with its payoff bar, then the manual extra payoff line and the debt-free month. */
export function DebtsBlockBody({ view, block, mode, onOpenLine, onLineAction, onAdd, onOpenLinked }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const { formatMonth } = useLocalizedFormatters()
  const money = (n: number) => formatCurrency(n, view.base, false)
  const month = mode === 'month'
  const { debts, debtFreeMonth } = view.extras
  const linked = block.lines.filter((l) => l.line.linkType === 'debts')
  const extras = block.lines.filter((l) => l.line.linkType !== 'debts')
  const pendingExtra = month ? extras.find((l) => !l.paid && l.amount > 0) : undefined
  const driftedLinked = linked.find((l) => l.status.kind !== 'ok')

  return (
    <BodyFrame>
      <FlatCard divide>
        {debts.map((d) => (
          <div key={d.id}>
            <button type="button" onClick={() => onOpenLinked('debts')} className="flex w-full flex-col gap-2 px-3.5 py-3 text-start">
              <span className="flex items-center gap-3">
                <TintedTile cat={3} size={36}>
                  <LineIcon name={DEBT_ICON[d.kind]} />
                </TintedTile>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{d.name}</span>
                  {month ? (
                    d.paidThisCycle ? (
                      <StatusLine tone="ok" icon={lineStatusIcon('check')}>{t.debts.paidThisCycle}</StatusLine>
                    ) : (
                      <StatusLine tone="warn" icon={Clock}>{t.debts.minimumDue}</StatusLine>
                    )
                  ) : (
                    <span className="truncate text-xs text-[var(--color-brand-text-secondary)]">
                      {d.installment ? t.debts.installment(d.installment.done, d.installment.total) : t.debts.minimum}
                    </span>
                  )}
                </span>
                <span className="min-w-14 text-end font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)]">
                  {money(d.minimum)}
                </span>
              </span>
              <ThinBar fill={d.paidPercent} color="var(--color-cat-3)" />
              <span className="flex items-center justify-between text-xs text-[var(--color-brand-text-secondary)]">
                <span className="font-mono-numbers">
                  {d.installment ? t.debts.installmentPaid(d.installment.done, d.installment.total) : t.debts.paidOff(Math.round(d.paidPercent))}
                </span>
                <span className="font-mono-numbers">{t.debts.left(money(d.balance))}</span>
              </span>
            </button>
          </div>
        ))}

        {driftedLinked ? (
          <div className="flex items-center gap-2 px-3.5 py-2">
            <StatusLine tone={driftedLinked.status.tone} icon={lineStatusIcon(driftedLinked.status.icon)} className="flex-1">
              {driftedLinked.line.name}
            </StatusLine>
            {driftedLinked.status.button.action !== 'none' ? (
              <ActionButton
                action={driftedLinked.status.button.action}
                variant={driftedLinked.status.button.variant}
                onClick={() => onLineAction(driftedLinked, driftedLinked.status.button.action)}
              />
            ) : null}
          </div>
        ) : null}

        {extras.map((lv) => (
          <LineRow
            key={lv.line.id}
            view={view}
            lv={lv}
            mode={mode}
            sub={month ? (lv.paid ? t.debts.extraSent : t.debts.extraPending) : t.debts.extraSub}
            onOpen={() => onOpenLine(lv.line.id)}
            onAction={(a) => onLineAction(lv, a)}
          />
        ))}

        {pendingExtra ? (
          <div className="flex items-center gap-2 px-3.5 py-2">
            <StatusLine tone="warn" icon={TriangleAlert} className="flex-1">
              {t.debts.extraStillAimed(money(pendingExtra.amount))}
            </StatusLine>
            <ActionButton action="pay" variant="default" label={t.debts.sendExtra(money(pendingExtra.amount))} onClick={() => onLineAction(pendingExtra, 'pay')} />
          </div>
        ) : null}

        {debtFreeMonth ? (
          <div className="px-3.5 py-2.5">
            <StatusLine tone="pri" icon={Flag} className="text-[13px]">{t.debts.debtFree(formatMonth(debtFreeMonth))}</StatusLine>
          </div>
        ) : null}

        <AddRow label={t.debts.add} onClick={() => onAdd('debts')} />
      </FlatCard>
    </BodyFrame>
  )
}
