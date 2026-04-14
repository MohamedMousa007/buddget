'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { IncomeSourceTypePicker } from '@/components/features/income/IncomeSourceTypePicker'
import type { Dictionary } from '@/lib/i18n/types'
import type { Currency, IncomeSourceType } from '@/lib/store/types'

type Props = {
  t: Dictionary
  name: string
  setName: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  currency: Currency
  setCurrency: (v: Currency) => void
  sourceType: IncomeSourceType
  onSourceTypeChange: (st: IncomeSourceType) => void
}

/** Source type pills, name, amount, and currency for add-income. */
export function AddIncomeTypeAndAmount({
  t,
  name,
  setName,
  amount,
  setAmount,
  currency,
  setCurrency,
  sourceType,
  onSourceTypeChange,
}: Props) {
  return (
    <>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelSourceType}</Label>
        <div className="mt-2">
          <IncomeSourceTypePicker
            value={sourceType}
            onChange={onSourceTypeChange}
            labels={t.income}
            mode="manual"
          />
        </div>
        {sourceType === 'salary' ? (
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{t.addIncome.salaryRecurringHint}</p>
        ) : null}
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelSource}</Label>
        <Input
          placeholder={t.addIncome.placeholderSource}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelAmount}</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={t.addIncome.placeholderAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelCurrency}</Label>
          <FiatCurrencySelect
            value={currency}
            onChange={setCurrency}
            className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
          />
        </div>
      </div>
    </>
  )
}
