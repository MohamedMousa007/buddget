'use client'

import { cn } from '@/lib/utils'
import type { SubscriptionPlan } from '@/lib/constants/subscriptionCatalog'
import type { Currency } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

/**
 * Plan selection chips for the add-subscription configure step.
 */
export function SubscriptionPlanPicker({
  plans,
  selectedIndex,
  onSelect,
  currency,
}: {
  plans: SubscriptionPlan[]
  selectedIndex: number
  onSelect: (index: number) => void
  currency: Currency
}) {
  if (plans.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {plans.map((pl, i) => {
        const selected = i === selectedIndex
        return (
          <button
            key={`${pl.name}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-medium border transition-colors',
              selected
                ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]'
                : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'
            )}
          >
            {pl.name} {formatCurrency(pl.amount, currency)}
          </button>
        )
      })}
    </div>
  )
}
