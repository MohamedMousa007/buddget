'use client'

import { format, parseISO } from 'date-fns'
import type { Debt, DebtPayment } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { installmentPaymentsCompleted, nextInstallmentDueFormatted } from '@/lib/debts/installmentSchedule'
import { calculateDebtRemaining } from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'

type DebtCardPlanMetaProps = {
  debt: Debt
  payments: DebtPayment[]
  paidOff: boolean
}

/**
 * Debt type badge, installment segment bar, and payoff goal summary on the debt card.
 */
export function DebtCardPlanMeta({ debt, payments, paidOff }: DebtCardPlanMetaProps) {
  const t = useT()
  const remaining = calculateDebtRemaining(debt, payments)
  const completed = installmentPaymentsCompleted(debt, payments.length)
  const nextDue = nextInstallmentDueFormatted(debt, payments.length)

  const kindLabel =
    debt.debtType === 'personal'
      ? t.debts.debtTypePersonal
      : debt.debtType === 'installment'
        ? t.debts.debtTypeInstallment
        : debt.debtType === 'general'
          ? t.debts.debtTypeGeneral
          : null

  const goal = debt.goal
  const targetPassed =
    goal && !paidOff && remaining > 0 && parseISO(goal.targetDate + 'T12:00:00') < new Date()

  const freqSuffix =
    goal &&
    (goal.paymentFrequency === 'weekly'
      ? t.addDebt.goalSuffixWeekly
      : goal.paymentFrequency === 'monthly'
        ? t.addDebt.goalSuffixMonthly
        : goal.paymentFrequency === 'quarterly'
          ? t.addDebt.goalSuffixQuarterly
          : t.addDebt.goalSuffixAnnually)

  return (
    <>
      {kindLabel ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] uppercase tracking-wide">
            {kindLabel}
          </span>
        </div>
      ) : null}

      {debt.debtType === 'installment' && debt.installmentCount && debt.installmentCount > 0 ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex gap-0.5">
            {Array.from({ length: debt.installmentCount }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 min-w-[6px] flex-1 rounded-sm ${
                  i < completed ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            {t.debts.installmentProgress(completed, debt.installmentCount)}
            {nextDue ? ` · ${t.debts.installmentNextDue(nextDue)}` : ''}
          </p>
        </div>
      ) : null}

      {goal && !paidOff ? (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            targetPassed
              ? 'border-[var(--color-brand-amber)]/50 bg-[var(--color-brand-amber)]/10'
              : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/30'
          }`}
        >
          <p className="text-[var(--color-brand-text-secondary)]">{t.debts.goalPayoffLine}</p>
          <p className="font-mono-numbers text-white mt-0.5">
            {format(parseISO(goal.targetDate + 'T12:00:00'), 'MMM yyyy')} ·{' '}
            {formatCurrency(goal.calculatedAmount, debt.isGold ? 'XAU' : debt.currency)}
            {freqSuffix ? <span className="text-[var(--color-brand-text-muted)]">{freqSuffix}</span> : null}
          </p>
          {targetPassed ? (
            <p className="text-[var(--color-brand-amber)] mt-1">{t.debts.goalTargetPassed}</p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
