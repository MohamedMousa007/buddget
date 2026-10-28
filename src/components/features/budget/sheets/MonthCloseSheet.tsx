'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { MonthCloseState } from '@/hooks/useMonthClose'
import type { CloseProposal } from '@/lib/budget/monthClose'
import type { Currency } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { percentText } from '../chromeFormat'
import { useBudgetCloseCopy } from '../useCloseCopy'

export interface MonthCloseSheetProps {
  open: boolean
  close: MonthCloseState | null
  base: Currency
  month: string
  onApply: (p: CloseProposal) => void
  /** Marks the cycle closed, applied or not; says which proposals were applied so the app remembers the rest were passed. */
  onFinish: (appliedLineIds: ReadonlySet<string>) => void
  /** Dismiss without marking the cycle closed, so the card stays until Done is pressed. */
  onDismiss: () => void
}

/** The month in numbers, the lines that overran, and small one-tap fixes. */
export function MonthCloseSheet({ open, close, base, month, onApply, onFinish, onDismiss }: MonthCloseSheetProps) {
  return (
    <ModalShell open={open && close != null} onBackdropClick={onDismiss} padContent>
      {open && close ? <CloseBody close={close} base={base} month={month} onApply={onApply} onFinish={onFinish} onDismiss={onDismiss} /> : null}
    </ModalShell>
  )
}

function CloseBody({ close, base, month, onApply, onFinish, onDismiss }: Omit<MonthCloseSheetProps, 'open' | 'close'> & { close: MonthCloseState }) {
  const c = useBudgetCloseCopy().sheet
  const [applied, setApplied] = useState<ReadonlySet<string>>(new Set())
  const money = (n: number) => formatCurrency(n, base, false)
  const { summary, proposals } = close
  const r = summary.result
  const verdict = !r ? null : r.kind === 'onPlan' ? c.onPlan : r.kind === 'kept' ? c.kept(percentText(r.percent)) : c.over(money(r.amount))
  const good = r?.kind !== 'over'

  return (
    <div className="flex flex-col gap-4 pt-1">
      <ModalSheetHeader title={c.title(month)} onClose={onDismiss} titleRowClassName="mb-0" />

      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex justify-between">
          <div>
            <p className={microClassName}>{c.planned}</p>
            <p className="font-mono-numbers text-xl font-semibold text-[var(--color-brand-text-primary)]">{money(summary.planned)}</p>
          </div>
          <div className="text-end">
            <p className={microClassName}>{c.spent}</p>
            <p className="font-mono-numbers text-xl font-semibold text-[var(--color-brand-text-primary)]">{money(summary.spent)}</p>
          </div>
        </div>
        {verdict ? (
          <p className={`text-sm font-semibold ${good ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red-text)]'}`}>{verdict}</p>
        ) : null}
        {summary.over.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-[var(--color-brand-border)] pt-3">
            <p className={microClassName}>{c.ran}</p>
            {summary.over.map((o) => (
              <p key={o.id} className="font-mono-numbers text-sm text-[var(--color-brand-text-secondary)]">
                {c.overBy(o.name, money(o.by))}
              </p>
            ))}
          </div>
        ) : null}
      </Card>

      {proposals.length === 0 ? (
        <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.none}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className={microClassName}>{c.fix}</p>
          {proposals.map((p) => {
            const done = applied.has(p.lineId)
            return (
              <Card key={p.lineId} padding="md" className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-[var(--color-brand-text-primary)]">
                  {p.kind === 'raise' ? c.raise(p.name, p.months, money(p.to)) : c.lower(p.name, money(p.average), money(p.from), money(p.to))}
                </p>
                <Button
                  size="touch"
                  variant={done ? 'outline' : 'default'}
                  disabled={done}
                  onClick={() => {
                    onApply(p)
                    setApplied((prev) => new Set(prev).add(p.lineId))
                  }}
                >
                  {done ? <Check aria-hidden /> : null}
                  {done ? c.applied : c.apply}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <Button size="cta" className="w-full" onClick={() => onFinish(applied)}>
        {c.done}
      </Button>
    </div>
  )
}
