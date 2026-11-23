'use client'

import { useState } from 'react'
import { addMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { debtPayoff } from '@/lib/insights/debtWhatIf'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency } from '@/lib/store/types'

interface Props {
  plan: { remaining: number; monthly: number }
  currency: Currency
  /** Free: the card is shown, the slider is not. */
  locked: boolean
  onUnlock: () => void
}

/** "Pay X more a month": how much sooner the instalment plans end. A native range input, so it works with touch and keyboard. */
export function WhatIfCard({ plan, currency, locked, onUnlock }: Props) {
  const c = useT().insights
  const { locale } = useLocale()
  const hidden = useMask('lists')
  const max = Math.max(100, Math.round(plan.monthly / 50) * 50)
  const step = Math.max(10, Math.round(max / 20 / 10) * 10)
  const [extra, setExtra] = useState(Math.round(max / 2 / step) * step)
  const result = debtPayoff(plan.remaining, plan.monthly, locked ? 0 : extra)
  if (!result) return null
  const money = (n: number) => (hidden ? MASK : formatCurrency(n, currency, false))
  const end = (months: number) => formatLocalized(addMonths(new Date(), months), 'MMM yyyy', locale)
  return (
    <Card padding="md" className="space-y-3">
      <p className="text-base font-bold text-[var(--color-brand-text-primary)]">{c.whatIf.extra(locked ? '••••' : money(extra))}</p>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={extra}
        disabled={locked}
        onChange={(e) => setExtra(Number(e.target.value))}
        aria-label={c.whatIf.extra(money(extra))}
        className="h-11 w-full accent-[var(--color-brand-primary)] disabled:opacity-50"
      />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-[var(--color-brand-bg)] p-3">
          <span className="text-[0.71875rem] font-semibold text-[var(--color-brand-text-muted)]">{c.whatIf.debtFree}</span>
          <b className="mt-0.5 block text-lg font-extrabold text-[var(--color-brand-text-primary)]">{end(locked ? result.months : result.monthsWithExtra)}</b>
          <small className="text-xs font-semibold text-[var(--color-brand-green)]">{!locked && result.monthsSooner > 0 ? c.whatIf.sooner(result.monthsSooner) : c.whatIf.months(result.months)}</small>
        </div>
        <div className="rounded-xl bg-[var(--color-brand-bg)] p-3">
          <span className="text-[0.71875rem] font-semibold text-[var(--color-brand-text-muted)]">{c.areas.debts.title}</span>
          <b className="mt-0.5 block font-mono-numbers text-lg font-extrabold text-[var(--color-brand-text-primary)]">{money(plan.remaining)}</b>
          <small className="text-xs text-[var(--color-brand-text-muted)]">{money(plan.monthly)} / {locale === 'ar' ? 'شهر' : 'mo'}</small>
        </div>
      </div>
      {locked && (
        <Button variant="ghost" size="touch" className="-mb-1.5 -ms-2 font-bold text-[var(--color-brand-gold)]" onClick={onUnlock}>
          {c.unlock} ›
        </Button>
      )}
    </Card>
  )
}
