'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ExpenseCategory, Currency } from '@/lib/store/types'
import { ONBOARDING_PLAN_DISPLAY_CATEGORIES } from '@/lib/onboarding/planPickerCopy'

export function OnboardingPlanPickerCategoryGrid({
  percents,
  monthlyTakeHome,
  baseCurrency,
  onPctChange,
  onAmtChange,
}: {
  percents: Record<ExpenseCategory, number>
  monthlyTakeHome: number
  baseCurrency: Currency
  onPctChange: (c: ExpenseCategory, v: string) => void
  onAmtChange: (c: ExpenseCategory, v: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-white mb-3">How do you want to plan your spending?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ONBOARDING_PLAN_DISPLAY_CATEGORIES.map((c) => {
          const pct = percents[c] ?? 0
          const amt = monthlyTakeHome > 0 ? (monthlyTakeHome * pct) / 100 : 0
          return (
            <div
              key={c}
              className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/35 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white font-medium">{c}</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String(pct)}
                    onChange={(e) => onPctChange(c, e.target.value)}
                    className="w-14 h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-xs px-2"
                  />
                  <span className="text-[var(--color-brand-text-muted)] text-xs">%</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-[10px] text-[var(--color-brand-text-muted)] shrink-0">
                  Amount ({baseCurrency})
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  disabled={monthlyTakeHome <= 0}
                  value={monthlyTakeHome > 0 ? String(Math.round(amt * 100) / 100) : ''}
                  onChange={(e) => onAmtChange(c, e.target.value)}
                  placeholder={monthlyTakeHome <= 0 ? 'Add your income first' : '0'}
                  className="flex-1 min-w-[6rem] h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-xs px-2"
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2">
        Set a monthly limit for each category. Buddget will track how you&apos;re doing in real time.
      </p>
    </div>
  )
}
