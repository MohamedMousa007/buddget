'use client'

import { ChevronRight, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { AppLink } from '@/components/ui/AppLink'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSubscriptionsMonthlyBaseTotal } from '@/hooks/useSubscriptionsMonthlyTotal'
import { useHydrateSubscriptions } from '@/hooks/remote'
import { formatCurrency } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import { upcomingBillingDate } from '@/lib/subscriptions/subscriptionDates'

/**
 * Recurring spend already spoken for this month. A link into the one /subscriptions list
 * (no second copy of it here); SMS detection is the other door.
 */
export function BudgetCommittedCard() {
  useHydrateSubscriptions()
  const t = useT()
  const subscriptions = useFinanceStore((s) => s.subscriptions)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const monthly = useSubscriptionsMonthlyBaseTotal()

  const { count, next } = useMemo(() => {
    const live = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial')
    const dated = live
      .map((s) => ({ name: s.name, date: upcomingBillingDate(s) }))
      .filter((s): s is { name: string; date: string } => s.date !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
    return { count: live.length, next: dated[0] }
  }, [subscriptions])

  return (
    <AppLink
      href="/subscriptions"
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4"
    >
      <RefreshCw className="size-5 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={microClassName}>{t.budgetPlanner.committedTitle}</p>
        <p className="mt-1 truncate text-sm font-medium text-[var(--color-brand-text-primary)]">
          {count > 0
            ? t.budgetPlanner.committedLine(count, formatCurrency(monthly, baseCurrency, false))
            : t.budgetPlanner.committedEmpty}
        </p>
        {next ? (
          <p className="mt-0.5 truncate text-xs text-[var(--color-brand-text-muted)]">
            {t.budgetPlanner.committedNext(next.name, shortDate(next.date))}
          </p>
        ) : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
    </AppLink>
  )
}
