'use client'

import { addDays, format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { PickerRow } from '@/components/ui/PickerRow'
import { useActionToast } from '@/components/ui/ActionToast'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cancelHint } from '@/lib/subscriptions/cancelHints'
import { chargeAmount, cycleState } from '@/lib/subscriptions/subscriptionForecast'
import { subscriptionToMonthlyPlannerAmount } from '@/lib/subscriptions/subscriptionRecurring'
import { convertCurrency } from '@/lib/utils/currency'
import { localTodayISO } from '@/lib/utils/localDate'
import { formatCurrency, formatFlex, formatWhole } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { BrandTile } from './BrandTile'
import { SheetFrame } from './SheetFrame'

function SaveCard({ label, amount, currency }: { label: string; amount: string; currency: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-brand-green-soft)] px-4 py-3">
      <p className="text-xs font-semibold text-[var(--color-brand-green)]">{label}</p>
      <p className="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">
        {amount} <span className="text-xs text-[var(--color-brand-text-muted)]">{currency}</span>
      </p>
    </div>
  )
}

/**
 * Cancel confirm (Light touch `s_subcancel`), no dark patterns: what it costs, what you save, the last day of access
 * (default: the end of the cycle already paid), where to cancel with the service, and a plain Keep it.
 */
export function CancelSubscriptionSheet({ subId, onClose }: { subId: string | null; onClose: () => void }) {
  const c = useDebtsSubsLtCopy().subs
  const howTo = useT().subscriptions.ui.cancel.howTo
  const toast = useActionToast()
  const { sub, expenses, cancel, base, rates } = useFinanceStore(
    useShallow((s) => ({
      sub: s.subscriptions.find((x) => x.id === subId) ?? null,
      expenses: s.expenses,
      cancel: s.cancelSubscription,
      base: s.settings.baseCurrency,
      rates: s.exchangeRates,
    })),
  )
  const suggested = useMemo(() => {
    if (!sub) return localTodayISO()
    const cs = cycleState(sub, expenses, new Date())
    // Paid through the day before the next charge; an unpaid open cycle is cancelled today.
    return cs.kind === 'upcoming' ? format(addDays(cs.due, -1), 'yyyy-MM-dd') : localTodayISO()
  }, [sub, expenses])
  const [endsOn, setEndsOn] = useState(suggested)
  if (!sub) return null
  const hint = cancelHint(sub.brandKey)
  const price = chargeAmount(sub)
  const monthlyBase = convertCurrency(subscriptionToMonthlyPlannerAmount(price, sub.billingCycle), sub.currency, base, rates)
  // "$9.99 USD" where the currency has a symbol, "190 EGP" where it does not.
  const withSymbol = formatCurrency(price, sub.currency, 'smart')
  const priceText = withSymbol.includes(sub.currency) ? formatFlex(price) : withSymbol
  const priceBase = sub.currency === base ? '' : `${formatWhole(convertCurrency(price, sub.currency, base, rates))} ${base}`

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={c.cancelTitle(sub.name)}
      footer={
        <>
          <Button
            variant="destructive-solid"
            size="cta-block"
            onClick={() => {
              cancel(sub.id, endsOn)
              toast(c.endsToast(sub.name))
              onClose()
            }}
          >
            {c.cancelCta}
          </Button>
          <Button variant="ghost" size="cta-block" className="text-[var(--color-brand-text-secondary)]" onClick={onClose}>
            {c.keep}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center pb-1 text-center">
        <BrandTile brandKey={sub.brandKey} name={sub.name} size={72} />
        <p dir="auto" className="mt-2.5 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{sub.name}</p>
        <p dir="ltr" className="mt-2 flex items-baseline gap-1.5 font-mono-numbers text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">
          {priceText}
          <span className="text-[1.125rem] text-[var(--color-brand-text-muted)]">{sub.currency}</span>
        </p>
        <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.cancelLine(sub.planName ?? '', c.repeats[sub.billingCycle].toLowerCase(), priceBase)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SaveCard label={c.saveMonth} amount={formatWhole(monthlyBase)} currency={base} />
        <SaveCard label={c.saveYear} amount={formatWhole(monthlyBase * 12)} currency={base} />
      </div>
      <SheetGroup note={c.cancelNote}>
        <PickerRow label={c.endsOn} value={<DatePickerField look="pill" value={endsOn} onChange={setEndsOn} />} />
        {hint?.url ? (
          <a href={hint.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{c.cancelOn(hint.text)}</span>
            <span className="text-[0.84375rem] font-semibold text-[var(--color-brand-primary-ink)]">{c.open}</span>
          </a>
        ) : hint ? (
          <PickerRow label={howTo} value={<span dir="auto" className="truncate text-[0.875rem] font-normal">{hint.text}</span>} />
        ) : null}
      </SheetGroup>
    </SheetFrame>
  )
}
