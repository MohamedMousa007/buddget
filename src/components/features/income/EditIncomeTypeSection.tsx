'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { Label } from '@/components/ui/label'
import { IncomeSourceTypePicker } from '@/components/features/income/IncomeSourceTypePicker'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import type { Dictionary } from '@/lib/i18n/types'
import type { Debt, IncomeSource, SavingsAccount } from '@/lib/store/types'
import type { IncomeSourceType } from '@/lib/store/types'

type Props = {
  t: Dictionary
  source: IncomeSource
  sourceType: IncomeSourceType
  setSourceType: (v: IncomeSourceType) => void
  typeLocked: boolean
  linkedAcc: SavingsAccount | undefined
  linkedDebt: Debt | undefined
}

/** Read-only or editable source type plus linked account / debt hints. */
export function EditIncomeTypeSection({
  t,
  source,
  sourceType,
  setSourceType,
  typeLocked,
  linkedAcc,
  linkedDebt,
}: Props) {
  return (
    <>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelSourceType}</Label>
        {typeLocked ? (
          <p className="mt-2 text-sm text-[var(--color-brand-text-primary)]">
            {incomeSourceTypeLabel(t.income, source.sourceType ?? 'other')}
          </p>
        ) : (
          <div className="mt-2">
            <IncomeSourceTypePicker
              value={sourceType}
              onChange={setSourceType}
              labels={t.income}
              mode="manual"
            />
          </div>
        )}
        {sourceType === 'salary' && !typeLocked ? (
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{t.editIncome.salaryRecurringHint}</p>
        ) : null}
      </div>

      {linkedAcc ? (
        <p className="text-xs text-[var(--color-brand-text-muted)]">{t.income.linkedAccountName(linkedAcc.name)}</p>
      ) : null}
      {linkedDebt ? (
        <p className="text-xs">
          <Link href="/debts" className="text-[var(--color-brand-red)] hover:underline">
            {t.income.linkedToDebt(linkedDebt.name)}
          </Link>
        </p>
      ) : null}
    </>
  )
}
