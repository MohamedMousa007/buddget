'use client'

import { useT } from '@/lib/i18n'
import { OptionChip } from '@/components/ui/OptionChip'

export type ExpenseDebtFilterMode = 'all' | 'debt_only' | 'exclude_debt'

type ReportExpenseDebtFilterProps = {
  value: ExpenseDebtFilterMode
  onChange: (v: ExpenseDebtFilterMode) => void
}

/**
 * Toggle whether expense aggregates include debt-payment expenses or exclude them.
 */
export function ReportExpenseDebtFilter({ value, onChange }: ReportExpenseDebtFilterProps) {
  const t = useT()
  const options: { value: ExpenseDebtFilterMode; label: string }[] = [
    { value: 'all', label: t.reports.expenseFilterAll },
    { value: 'debt_only', label: t.reports.expenseFilterDebtOnly },
    { value: 'exclude_debt', label: t.reports.expenseFilterExcludeDebt },
  ]

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.reports.expenseFilterHeading}
      </p>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {options.map((opt) => (
          <OptionChip
            key={opt.value}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </OptionChip>
        ))}
      </div>
    </div>
  )
}
