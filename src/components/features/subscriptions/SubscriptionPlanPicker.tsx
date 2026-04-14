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
 * Horizontal pricing cards for regional plans; selected state uses brand color (border + tint).
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
    <div className="-mx-1 overflow-x-auto overflow-y-visible pb-1 [scrollbar-width:thin]">
      <div
        className={cn(
          'flex min-w-min gap-3 px-1',
          'snap-x snap-mandatory sm:flex-wrap sm:overflow-visible sm:snap-none'
        )}
      >
        {plans.map((pl, i) => {
          const selected = i === selectedIndex
          const suffix = cycleSuffix(pl.cycle, cycleLabels)
          return (
            <button
              key={`${pl.name}-${i}`}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                'snap-start shrink-0 rounded-xl border border-solid text-left transition-colors',
                'flex min-h-[7.5rem] w-[9rem] flex-col justify-between sm:w-[9.25rem]',
                'px-3 py-3',
                selected
                  ? 'shadow-sm'
                  : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-card)]'
              )}
              style={
                selected
                  ? {
                      borderColor: brandColor,
                      backgroundColor: `${brandColor}1A`,
                      boxShadow: `inset 0 3px 0 0 ${brandColor}, inset 4px 0 0 0 ${brandColor}`,
                    }
                  : undefined
              }
            >
              <span className="text-[15px] font-semibold leading-tight text-[var(--color-brand-text-primary)] line-clamp-2">
                {pl.name}
              </span>
              <div className="mt-2">
                <span className="font-mono-numbers text-xl font-semibold tabular-nums text-[var(--color-brand-text-primary)]">
                  {formatCurrency(pl.amount, currency)}
                </span>
                <span className="ms-0.5 text-xs font-normal text-[var(--color-brand-text-muted)]">{suffix}</span>
              </div>
              {pl.description ? (
                <span className="mt-2 text-[10px] leading-snug text-[var(--color-brand-text-secondary)] line-clamp-2">
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
