'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NumberPad } from '@/components/ui/NumberPad'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { cn } from '@/lib/utils'
import type { AppSettings, BudgetPlanCategory, Currency } from '@/lib/store/types'
import { planCategoryCurrency } from '@/lib/budget/budgetPlans'
import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'

export interface BudgetPlannerCategoryCurrencyAmountFieldProps {
  category: BudgetPlanCategory
  settings: AppSettings
  hasSubs: boolean
  amountLabel: string
  amountPlaceholder: string
  categoryAmountInputValue: string
  onAmountChange: (value: string) => void
  onAmountFocus: () => void
  onAmountBlur: () => void
  onCurrencyChange: (currency: Currency) => void
}

/** Compact currency control and amount input for one plan row. */
export function BudgetPlannerCategoryCurrencyAmountField({
  category,
  settings,
  hasSubs,
  amountLabel,
  amountPlaceholder,
  categoryAmountInputValue,
  onAmountChange,
  onAmountFocus,
  onAmountBlur,
  onCurrencyChange,
}: BudgetPlannerCategoryCurrencyAmountFieldProps) {
  const [padOpen, setPadOpen] = useState(false)
  const rowCurrency = planCategoryCurrency(category, settings.baseCurrency)
  const fiatOpts = buildFiatCurrencyPickerOptions(settings)
  const codes = fiatOpts.map((o) => o.value)
  const singleCurrency = codes.length <= 1

  const currencyTrigger = singleCurrency ? (
    <span className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1 font-mono text-xs text-[var(--color-brand-text-secondary)]">
      {rowCurrency}
    </span>
  ) : (
    <CurrencyField
      value={rowCurrency}
      onChange={onCurrencyChange}
      codes={codes}
      compact
      className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5"
    />
  )

  return (
    <div className="flex items-center gap-1">
      {currencyTrigger}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase text-[var(--color-brand-text-muted)]">{amountLabel}</span>
        <button
          type="button"
          disabled={hasSubs}
          onClick={() => {
            if (hasSubs) return
            onAmountFocus()
            setPadOpen(true)
          }}
          className={cn(
            'w-24 flex items-center rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5 font-mono text-sm text-start',
            hasSubs && 'cursor-not-allowed opacity-60'
          )}
        >
          <span className={categoryAmountInputValue ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-text-muted)]'}>
            {categoryAmountInputValue || amountPlaceholder}
          </span>
        </button>
        {padOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <NumberPad
              value={categoryAmountInputValue}
              onChange={onAmountChange}
              onDone={() => {
                onAmountBlur()
                setPadOpen(false)
              }}
              onClose={() => {
                onAmountBlur()
                setPadOpen(false)
              }}
            />,
            document.body,
          )}
      </div>
    </div>
  )
}
