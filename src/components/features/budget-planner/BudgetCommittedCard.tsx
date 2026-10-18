'use client'

import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AppLink } from '@/components/ui/AppLink'
import { Card } from '@/components/ui/card'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import { useHydrateExpenses, useHydrateSubscriptions } from '@/hooks/remote'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useLocale, useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { chargesLeftThisMonth, yearlySetAside } from '@/lib/subscriptions/subscriptionForecast'
import { money2 } from '@/lib/subscriptions/subscriptionFormat'
import { currencyLabel } from '@/components/features/subscriptions/subscriptionLabels'
import { format } from 'date-fns'

const LABEL = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]'

/**
 * What is already spoken for this month: subscription charges still to pay, from their real
 * due dates (trials, paused and cancelled plans excluded). Yearly plans are a separate
 * set-aside line, not part of the month's total.
 */
export function BudgetCommittedCard() {
  useHydrateSubscriptions()
  useHydrateExpenses()
  const t = useT()
  const { locale } = useLocale()
  const { shortDate: formatDateShort } = useSubscriptionDates()
  const ui = t.subscriptions.ui.budget
  const { subscriptions, expenses, base, rates } = useFinanceStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      expenses: s.expenses,
      base: s.settings.baseCurrency,
      rates: s.exchangeRates,
    })),
  )

  const { left, due, setAside } = useMemo(() => {
    const today = new Date()
    const charges = chargesLeftThisMonth(subscriptions, expenses, today, base, rates)
    return {
      left: charges.reduce((a, c) => a + c.amountBase, 0),
      due: charges,
      setAside: yearlySetAside(subscriptions, today, base, rates),
    }
  }, [subscriptions, expenses, base, rates])

  const next = due[0]
  const cur = currencyLabel(base, locale)

  return (
    <Card elevation="sm" className="flex flex-col gap-3">
      <p className={LABEL}>{ui.committed}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-mono-numbers text-[30px] font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
          {money2(left)}
        </span>
        <span className="text-[13px] text-[var(--color-brand-text-secondary)]">{cur}</span>
      </div>
      <p className="-mt-1.5 text-[13px] text-[var(--color-brand-text-secondary)]">{ui.leftToPay}</p>
      <AppLink
        href="/subscriptions"
        className="flex min-h-[60px] items-center gap-3 rounded-[14px] border border-[var(--color-brand-border)] px-3"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
          <RotateCwClock className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.nav.subscriptions}</span>
          <span className="block truncate text-xs text-[var(--color-brand-text-secondary)]">
            {next ? ui.entryLine(due.length, next.sub.name, formatDateShort(format(next.due, 'yyyy-MM-dd'))) : ui.nothingDue}
          </span>
        </span>
        <span className="font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{money2(left)}</span>
        <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
      </AppLink>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-[var(--color-brand-text-secondary)]">{ui.setAside}</span>
        <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
          {money2(setAside)} {cur}
        </span>
      </div>
    </Card>
  )
}
