'use client'

import { addDays, format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { useLocale, useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cancelHint } from '@/lib/subscriptions/cancelHints'
import { chargeAmount, cycleState } from '@/lib/subscriptions/subscriptionForecast'
import { localTodayISO } from '@/lib/utils/localDate'
import { BrandTile } from './BrandTile'
import { FieldLabel, SheetFrame } from './SheetFrame'
import { currencyLabel, cycleWord } from './subscriptionLabels'
import { formatFixed2 } from '@/lib/utils/formatters'

/**
 * Cancel confirm, no dark patterns: the last day of access (default: the end of the cycle
 * already paid), how to cancel with the service, what Buddget does, and a plain Keep it.
 */
export function CancelSubscriptionSheet({ subId, onClose }: { subId: string | null; onClose: () => void }) {
  const t = useT()
  const { locale } = useLocale()
  const ui = t.subscriptions.ui
  const { sub, expenses, cancel } = useFinanceStore(
    useShallow((s) => ({
      sub: s.subscriptions.find((x) => x.id === subId) ?? null,
      expenses: s.expenses,
      cancel: s.cancelSubscription,
    })),
  )
  const suggested = useMemo(() => {
    if (!sub) return localTodayISO()
    const c = cycleState(sub, expenses, new Date())
    // Paid through the day before the next charge; an unpaid open cycle is cancelled today.
    return c.kind === 'upcoming' ? format(addDays(c.due, -1), 'yyyy-MM-dd') : localTodayISO()
  }, [sub, expenses])
  const [endsOn, setEndsOn] = useState(suggested)
  if (!sub) return null
  const hint = cancelHint(sub.brandKey)

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={ui.cancel.title(sub.name)}
      footer={
        <>
          <Button
            variant="destructive"
            size="cta-block"
            onClick={() => {
              cancel(sub.id, endsOn)
              onClose()
            }}
          >
            {ui.cancel.confirm}
          </Button>
          <Button variant="ghost" size="cta-block" onClick={onClose}>
            {ui.cancel.keep}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <BrandTile brandKey={sub.brandKey} name={sub.name} size={48} />
        <div>
          <div className="text-base font-semibold text-[var(--color-brand-text-primary)]">
            {sub.name}
            {sub.planName ? ` · ${sub.planName}` : ''}
          </div>
          <div className="font-mono-numbers text-[13px] text-[var(--color-brand-text-secondary)]">
            {formatFixed2(chargeAmount(sub))} {currencyLabel(sub.currency, locale)} {cycleWord(sub.billingCycle, ui)}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{ui.cancel.endsOn}</FieldLabel>
        <DatePickerField value={endsOn} onChange={setEndsOn} className="h-12 rounded-xl font-mono-numbers" />
        <span className="text-xs text-[var(--color-brand-text-secondary)]">{ui.cancel.note}</span>
      </div>
      {hint ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-[var(--color-brand-border)] px-3.5 py-3">
          <FieldLabel>{ui.cancel.howTo}</FieldLabel>
          <span className="text-sm text-[var(--color-brand-text-primary)]">{hint.url ? ui.cancel.hintLabel : hint.text}</span>
          {hint.url ? (
            <a
              href={hint.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center text-[13px] font-semibold text-[var(--color-brand-primary-ink)]"
            >
              {ui.cancel.open(hint.text)}
            </a>
          ) : null}
        </div>
      ) : null}
      <p className="text-[13px] text-[var(--color-brand-text-secondary)]">{ui.cancel.effect}</p>
    </SheetFrame>
  )
}
