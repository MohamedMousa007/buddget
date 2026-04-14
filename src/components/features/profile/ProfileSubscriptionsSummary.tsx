'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useShallow } from 'zustand/react/shallow'
import { RefreshCw } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSubscriptionsMonthlyBaseTotal } from '@/hooks/useSubscriptionsMonthlyTotal'
import { useT } from '@/lib/i18n'
import { formatCurrency } from '@/lib/utils/formatters'

/**
 * Profile page card: active subscription count and monthly total with link to /subscriptions.
 */
export function ProfileSubscriptionsSummary() {
  const t = useT()
  const { settings } = useFinanceStore(useShallow((s) => ({ settings: s.settings })))
  const subscriptions = useFinanceStore(useShallow((s) => s.subscriptions))
  const monthlyTotal = useSubscriptionsMonthlyBaseTotal()

  const activeCount = useMemo(
    () => subscriptions.filter((s) => s.status === 'active' || s.status === 'trial').length,
    [subscriptions]
  )

  const totalFormatted = formatCurrency(monthlyTotal, settings.baseCurrency)

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[var(--color-brand-red)]" aria-hidden />
            {t.subscriptions.pageTitle}
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
            {t.subscriptions.profileSummary(activeCount, totalFormatted)}
          </p>
        </div>
        <Link
          href="/subscriptions"
          className="text-xs shrink-0 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
        >
          {t.subscriptions.manage} →
        </Link>
      </div>
    </div>
  )
}
