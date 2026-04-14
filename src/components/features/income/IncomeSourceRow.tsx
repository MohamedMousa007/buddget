'use client'

import Link from 'next/link'
import { IncomeSourceRowActions } from '@/components/features/income/IncomeSourceRowActions'
import type { Debt, IncomeSource, SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { incomeMonthlyMultiplier } from '@/lib/utils/calculations'
import type { Dictionary } from '@/lib/i18n'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'

function recurringSubtitle(source: IncomeSource, inc: Dictionary['income']): string {
  if (!source.isRecurring) return inc.oneTime
  const f = source.recurringFrequency ?? 'monthly'
  if (f === 'monthly') return inc.recurringMonthly(source.dayOfMonth ?? 1)
  if (f === 'biweekly') return inc.recurringBiweekly
  return inc.recurringWeekly
}

function typeAndRecurrenceLine(source: IncomeSource, inc: Dictionary['income']): string {
  const type = incomeSourceTypeLabel(inc, source.sourceType ?? 'other')
  return `${type} · ${recurringSubtitle(source, inc)}`
}

function amountLine(source: IncomeSource, inc: Dictionary['income']): string {
  const amt = formatCurrency(source.amount, source.currency)
  if (!source.isRecurring) return amt
  const f = source.recurringFrequency ?? 'monthly'
  if (f === 'monthly') return inc.perMonth(amt)
  if (f === 'biweekly') return inc.perPaycheck(amt)
  return inc.perWeek(amt)
}

function monthlyEquivNote(source: IncomeSource, inc: Dictionary['income']): string | null {
  if (!source.isRecurring) return null
  const m = incomeMonthlyMultiplier(source.recurringFrequency)
  if (m === 1) return null
  const eq = source.amount * m
  return inc.monthlyEquiv(formatCurrency(eq, source.currency))
}

export type IncomeSourceRowProps = {
  source: IncomeSource
  savingsAccounts: SavingsAccount[]
  debts: Debt[]
  inc: Dictionary['income']
  common: Dictionary['common']
  onEdit: () => void
  onDelete: () => void
}

/** Single income source card: type line, amount, linked savings/debt hints, actions. */
export function IncomeSourceRow({
  source,
  savingsAccounts,
  debts,
  inc,
  common,
  onEdit,
  onDelete,
}: IncomeSourceRowProps) {
  const linkedAcc =
    source.linkedSavingsAccountId != null
      ? savingsAccounts.find((a) => a.id === source.linkedSavingsAccountId)
      : undefined
  const linkedDebt = source.linkedDebtId != null ? debts.find((d) => d.id === source.linkedDebtId) : undefined
  const equiv = monthlyEquivNote(source, inc)

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 group">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">{source.name}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{typeAndRecurrenceLine(source, inc)}</p>
        {equiv ? (
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5">{equiv}</p>
        ) : null}
        {linkedAcc ? (
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5">
            {source.sourceType === 'investment' ? inc.linkedInvestmentNote : inc.linkedSavingsNote} ({linkedAcc.name})
          </p>
        ) : null}
        {linkedDebt ? (
          <p className="text-[10px] mt-0.5">
            <Link href="/debts" className="text-[var(--color-brand-red)] hover:underline">
              {inc.linkedToDebt(linkedDebt.name)}
            </Link>
          </p>
        ) : null}
      </div>
      <IncomeSourceRowActions
        amountLine={amountLine(source, inc)}
        editLabel={common.edit}
        deleteLabel={common.delete}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
