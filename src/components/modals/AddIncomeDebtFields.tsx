'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/types'

type Props = {
  t: Dictionary
  debtPerson: string
  setDebtPerson: (v: string) => void
  debtDescription: string
  setDebtDescription: (v: string) => void
}

/** Debt-only inputs for add-income (person + optional description). */
export function AddIncomeDebtFields({
  t,
  debtPerson,
  setDebtPerson,
  debtDescription,
  setDebtDescription,
}: Props) {
  return (
    <>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.income.debtPersonLabel}</Label>
        <Input
          placeholder={t.income.debtPersonPlaceholder}
          value={debtPerson}
          onChange={(e) => setDebtPerson(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.debtDescriptionLabel}</Label>
        <Input
          placeholder={t.addIncome.debtDescriptionPlaceholder}
          value={debtDescription}
          onChange={(e) => setDebtDescription(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
    </>
  )
}
