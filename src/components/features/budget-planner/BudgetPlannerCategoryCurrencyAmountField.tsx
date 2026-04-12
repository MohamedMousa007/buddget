'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const rowCurrency = planCategoryCurrency(category, settings.baseCurrency)
  const fiatOpts = buildFiatCurrencyPickerOptions(settings)
  const codes = fiatOpts.map((o) => o.value)
  const singleCurrency = codes.length <= 1

  const currencyTrigger = singleCurrency ? (
    <span className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1 font-mono text-xs text-[var(--color-brand-text-secondary)]">
      {rowCurrency}
    </span>
  ) : (
    <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
      <PopoverTrigger
        type="button"
        className="flex cursor-pointer items-center gap-0.5 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1 font-mono text-xs text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-primary)]/20"
      >
        {rowCurrency}
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="min-w-[8rem] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1 text-[var(--color-brand-text-primary)] shadow-xl"
      >
        <div className="flex flex-col gap-0.5">
          {codes.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onCurrencyChange(c)
                setCurrencyOpen(false)
              }}
              className={cn(
                'cursor-pointer rounded-lg px-2 py-1.5 text-left font-mono text-xs hover:bg-[var(--color-brand-border)]',
                c === rowCurrency && 'bg-[var(--color-brand-border)]/80'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )

  return (
    <div className="flex items-center gap-1">
      {currencyTrigger}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase text-[var(--color-brand-text-muted)]">{amountLabel}</span>
        <input
          type="text"
          inputMode="decimal"
          disabled={hasSubs}
          value={categoryAmountInputValue}
          onChange={(e) => !hasSubs && onAmountChange(e.target.value)}
          onFocus={onAmountFocus}
          onBlur={onAmountBlur}
          placeholder={amountPlaceholder}
          readOnly={hasSubs}
          className={cn(
            'w-24 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5 font-mono text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]',
            hasSubs && 'cursor-not-allowed opacity-60'
          )}
        />
      </div>
    </div>
  )
}
