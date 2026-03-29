'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

export interface MethodRow {
  name: string
  count: number
  total: number
}

export interface ReportsPaymentMethodPanelProps {
  methods: MethodRow[]
  baseCurrency: Currency
}

/**
 * Sorted list of spend by payment method for the filtered period.
 */
export function ReportsPaymentMethodPanel({ methods, baseCurrency }: ReportsPaymentMethodPanelProps) {
  const t = useT()
  if (methods.length === 0) return null
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
        {t.reports.howYouPay}
      </h3>
      <div className="space-y-2">
        {[...methods]
          .sort((a, b) => b.total - a.total)
          .map((method) => (
            <div
              key={method.name}
              className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0"
            >
              <span className="text-sm text-white">{method.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[var(--color-brand-text-muted)]">
                  {method.count} {method.count !== 1 ? t.reports.usePlural : t.reports.useSingular}
                </span>
                <span className="text-sm font-mono-numbers text-white">
                  {formatCurrency(method.total, baseCurrency)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
