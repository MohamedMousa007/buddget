'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { format, parseISO } from 'date-fns'
import { Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  computeCreditCardOutstanding,
  creditUtilizationRatio,
  daysUntilDue,
  getCurrentBillingCycleExpenses,
  getNextCreditCardDueDate,
  minimumPaymentAmount,
  sumExpensesInDebtCurrency,
} from '@/lib/debt/computeCreditCardBalance'
import { CreditCardUtilizationBar } from '@/components/features/debts/CreditCardUtilizationBar'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency, Debt, DebtPayment } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

export interface CreditCardDebtCardProps {
  debt: Debt
  payments: DebtPayment[]
  onRecordPayment: () => void
  onEdit: () => void
}

/**
 * Revolving credit card summary: utilization, cycle spend, due date, and pay actions.
 */
export function CreditCardDebtCard({ debt, payments, onRecordPayment, onEdit }: CreditCardDebtCardProps) {
  const t = useT()
  const { expenses, exchangeRates, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      exchangeRates: s.exchangeRates,
      paymentMethods: s.paymentMethods,
    }))
  )

  const outstanding = useMemo(
    () => computeCreditCardOutstanding(debt, expenses, payments, exchangeRates),
    [debt, expenses, payments, exchangeRates]
  )
  const limit = debt.creditLimit
  const ratio = creditUtilizationRatio(outstanding, limit)

  const cycle = useMemo(
    () => getCurrentBillingCycleExpenses(debt, expenses, exchangeRates),
    [debt, expenses, exchangeRates]
  )
  const cycleSum = sumExpensesInDebtCurrency(cycle.expenses, debt.currency as Currency, exchangeRates)

  const dueIso = getNextCreditCardDueDate(debt, new Date())
  const daysLeft = dueIso ? daysUntilDue(dueIso, new Date()) : null
  const minPay = minimumPaymentAmount(outstanding, debt.minimumPaymentPercent)
  const pm = paymentMethods.find((m) => m.id === debt.linkedPaymentMethodId)
  const showSetupBanner = debt.creditLimit == null || debt.paymentDueDay == null

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 relative overflow-hidden border border-[var(--color-brand-border)]/80">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">💳</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{debt.name}</h3>
            {pm?.last4 ? (
              <span className="text-xs font-mono-numbers text-[var(--color-brand-text-muted)]">••{pm.last4}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0"
          aria-label={t.common.edit}
        >
          <Pencil className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)]" aria-hidden />
        </button>
      </div>

      {showSetupBanner ? (
        <button
          type="button"
          onClick={onEdit}
          className="mb-4 w-full text-left rounded-xl border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2 text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]/70 transition-colors"
        >
          ⚙️ {t.debts.creditCardSetupHint}
        </button>
      ) : null}

      <div className="space-y-3">
        <div>
          <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.debts.outstandingBalance}</p>
          <p className="text-xl font-semibold font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatCurrency(outstanding, debt.currency)}
          </p>
          <CreditCardUtilizationBar ratio={ratio} utilizationLabel={t.debts.utilization} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[var(--color-brand-text-secondary)] text-xs">{t.debts.availableLimit}</p>
            <p className="font-mono-numbers text-[var(--color-brand-text-primary)]">
              {limit != null ? formatCurrency(Math.max(0, limit - outstanding), debt.currency) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[var(--color-brand-text-secondary)] text-xs">{t.debts.creditLimit}</p>
            <p className="font-mono-numbers text-[var(--color-brand-text-primary)]">
              {limit != null ? formatCurrency(limit, debt.currency) : '—'}
            </p>
          </div>
        </div>

        {dueIso && daysLeft != null ? (
          <p className="text-sm text-[var(--color-brand-text-secondary)]">
            {t.debts.dueDate}: {format(parseISO(dueIso), 'MMM d')} ({daysLeft} {t.debts.daysUntilDue})
          </p>
        ) : null}

        <p className="text-sm">
          <span className="text-[var(--color-brand-text-secondary)]">{t.debts.minimumPayment}: </span>
          <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatCurrency(minPay, debt.currency)}
            {debt.minimumPaymentPercent != null ? ` (${debt.minimumPaymentPercent}%)` : ''}
          </span>
        </p>

        <p className="text-sm">
          <span className="text-[var(--color-brand-text-secondary)]">{t.debts.thisMonthCharges}: </span>
          <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatCurrency(cycleSum, debt.currency)}
          </span>
        </p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onRecordPayment}
            className="flex-1 py-2.5 rounded-xl bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white text-sm font-medium transition-colors"
          >
            {t.debts.payNow}
          </button>
          {debt.linkedPaymentMethodId ? (
            <Link
              href={`/expenses?pm=${encodeURIComponent(debt.linkedPaymentMethodId)}`}
              className="flex-1 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-center text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              {t.debts.viewCharges}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
