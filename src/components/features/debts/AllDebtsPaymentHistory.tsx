'use client'

import { useMemo, useState } from 'react'
import { goldGramsToMoney } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useDebtPaymentHistoryRows } from '@/hooks/useDebtPaymentHistoryRows'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { AllDebtsPaymentHistoryTable } from '@/components/features/debts/AllDebtsPaymentHistoryTable'
import type { Debt, DebtPayment } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

interface AllDebtsPaymentHistoryProps {
  debts: Debt[]
  debtPayments: DebtPayment[]
}

/**
 * Single payment history list for every balance, with filter by balance (debt).
 */
export function AllDebtsPaymentHistory({ debts, debtPayments }: AllDebtsPaymentHistoryProps) {
  const t = useT()
  const { formatDateShort } = useLocalizedFormatters()
  const { deleteDebtPayment, settings, goldPricePerGram, exchangeRates } = useFinanceStore()
  const base = settings.baseCurrency
  const allRows = useDebtPaymentHistoryRows(debts, debtPayments)
  const [filterDebtId, setFilterDebtId] = useState<string>('all')

  const rows = useMemo(
    () =>
      filterDebtId === 'all' ? allRows : allRows.filter((r) => r.debt.id === filterDebtId),
    [allRows, filterDebtId]
  )

  const toBase = (debt: Debt, debtUnitAmount: number) => {
    if (debt.isGold) return goldGramsToMoney(debtUnitAmount, goldPricePerGram, debt.goldKarat)
    return convertCurrency(debtUnitAmount, debt.currency, base, exchangeRates)
  }

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.debts.paymentHistorySectionTitle}
        </h2>
        <label className="flex flex-col gap-1.5 sm:min-w-[min(100%,220px)]">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {t.debts.filterByDebt}
          </span>
          <select
            value={filterDebtId}
            onChange={(e) => setFilterDebtId(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2.5 text-sm text-[var(--color-brand-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-red)]/40 transition-colors"
          >
            <option value="all">{t.debts.allDebtsFilter}</option>
            {debts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-brand-text-muted)] text-center py-4">
          {t.debts.emptyPayments}
        </p>
      ) : (
        <AllDebtsPaymentHistoryTable
          rows={rows}
          baseCurrency={base}
          formatDateShort={formatDateShort}
          toBase={toBase}
          deleteDebtPayment={deleteDebtPayment}
          t={t.debts}
        />
      )}
    </section>
  )
}
