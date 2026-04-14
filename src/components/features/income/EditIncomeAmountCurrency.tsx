'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { Dictionary } from '@/lib/i18n/types'
import type { Currency } from '@/lib/store/types'

type Props = {
  t: Dictionary
  name: string
  setName: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  currency: Currency
  setCurrency: (v: Currency) => void
}

export function EditIncomeAmountCurrency({ t, name, setName, amount, setAmount, currency, setCurrency }: Props) {
  return (
    <>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelSource}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelAmount}</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelCurrency}</Label>
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
