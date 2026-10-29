'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MAX_INSIGHTS, type Insight } from '@/lib/budget/insights'
import type { Currency } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface InsightsSheetProps {
  open: boolean
  insights: Insight[]
  base: Currency
  onClose: () => void
  onInsightAction: (insight: Insight) => void
  /** Adds a "Not now" button per insight when provided. */
  onDismiss?: (insight: Insight) => void
}

const MONEY_PARAMS = new Set(['housing', 'essentials', 'live', 'planned', 'delta', 'amount', 'avg3'])

export function InsightsSheet({ open, insights, base, onClose, onInsightAction, onDismiss }: InsightsSheetProps) {
  const c = useBudgetChromeCopy().insights
  const text = (i: Insight) =>
    Object.fromEntries(
      Object.entries(i.params).map(([k, v]) => [
        k,
        typeof v === 'number' && MONEY_PARAMS.has(k) ? formatCurrency(Math.abs(v), base, false) : typeof v === 'number' ? String(Math.round(v * 10) / 10) : v,
      ]),
    )
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      <V3SheetHeader title={c.sheetTitle} onClose={onClose} />
      <ul className="flex flex-col gap-3">
        {insights.slice(0, MAX_INSIGHTS).map((i) => (
          <li key={i.id}>
            <Card variant="elevated" padding="md" radius="default" className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-card)]">
                  <BuddgyIcon mood={i.mood} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold leading-snug text-[var(--color-brand-text-primary)]">{c.finding[i.kind](text(i))}</p>
                  <p className={`${microClassName} mt-2`}>{c.why}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-brand-text-secondary)]">{c.reason[i.kind](text(i))}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="touch" className="flex-1" onClick={() => onInsightAction(i)}>
                  {c.action[i.action]}
                </Button>
                {onDismiss ? (
                  <Button size="touch" variant="ghost" className="flex-1" onClick={() => onDismiss(i)}>
                    {c.dismiss}
                  </Button>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </ModalShell>
  )
}
