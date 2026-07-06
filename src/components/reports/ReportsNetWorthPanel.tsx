'use client'

import { AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { formatCurrency } from '@/lib/utils/formatters'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'

/**
 * Snapshot card for reports: same net-worth formula as the dashboard.
 */
export function ReportsNetWorthPanel() {
  const t = useT()
  const nw = useNetWorth()
  const secondary = useFinanceStore(useShallow((s) => s.settings.secondaryCurrency))

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
        {t.reports.netWorthTitle}
      </h2>
      <p
        className={`text-2xl font-bold font-mono-numbers ${
          nw.netWorth >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red-text)]'
        }`}
      >
        {formatCurrency(nw.netWorth, nw.baseCurrency, true)}
      </p>
      {nw.netWorthSecondary != null && secondary ? (
        <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
          ({formatCurrency(nw.netWorthSecondary, secondary, true)})
        </p>
      ) : null}
      {nw.netWorthGoldIncomplete ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)] flex items-start gap-1.5 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-brand-gold)]" aria-hidden />
          <span>{t.reports.netWorthGoldIncomplete}</span>
        </p>
      ) : null}
      <p className="text-xs text-[var(--color-brand-text-secondary)] leading-relaxed pt-1 border-t border-[var(--color-brand-border)]/50">
        {t.reports.netWorthHint}
      </p>
    </section>
  )
}
