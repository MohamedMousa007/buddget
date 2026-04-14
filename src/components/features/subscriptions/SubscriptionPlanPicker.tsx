'use client'

import { cn } from '@/lib/utils'
import type { SubscriptionPlan } from '@/lib/constants/subscriptionCatalog'
import type { Currency, SubscriptionBillingCycle } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

function cycleSuffix(
  cycle: SubscriptionBillingCycle,
  labels: { mo: string; yr: string; wk: string; qtr: string }
) {
  switch (cycle) {
    case 'yearly':
      return labels.yr
    case 'weekly':
      return labels.wk
    case 'quarterly':
      return labels.qtr
    default:
      return labels.mo
  }
}

/**
 * Horizontal pricing cards for regional plans; accent uses `brandColor` when selected.
 */
export function SubscriptionPlanPicker({
  plans,
  selectedIndex,
  onSelect,
  currency,
  brandColor,
  cycleLabels,
}: {
  plans: SubscriptionPlan[]
  selectedIndex: number
  onSelect: (index: number) => void
  currency: Currency
  brandColor: string
  cycleLabels: { mo: string; yr: string; wk: string; qtr: string }
}) {
  if (plans.length === 0) return null

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex gap-3 min-w-min sm:flex-wrap sm:overflow-visible">
        {plans.map((pl, i) => {
          const selected = i === selectedIndex
          const suffix = cycleSuffix(pl.cycle, cycleLabels)
          return (
            <button
              key={`${pl.name}-${i}`}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                'shrink-0 w-[8.5rem] sm:w-[9.25rem] rounded-xl border border-solid text-left transition-colors',
                'px-3 py-3 flex flex-col gap-1',
                selected ? 'shadow-sm' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-card)]'
              )}
              style={
                selected
                  ? {
                      borderColor: brandColor,
                      backgroundColor: `${brandColor}18`,
                      boxShadow: `inset 0 3px 0 0 ${brandColor}`,
                    }
                  : undefined
              }
            >
              <span className="text-sm font-semibold text-[var(--color-brand-text-primary)] leading-tight line-clamp-2">
                {pl.name}
              </span>
              <span className="text-lg font-mono-numbers font-semibold text-[var(--color-brand-text-primary)] tabular-nums">
                {formatCurrency(pl.amount, currency)}
                <span className="text-xs font-normal text-[var(--color-brand-text-muted)] ms-0.5">{suffix}</span>
              </span>
              {pl.description ? (
                <span className="text-[10px] leading-snug text-[var(--color-brand-text-secondary)] line-clamp-2">
                  {pl.description}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
