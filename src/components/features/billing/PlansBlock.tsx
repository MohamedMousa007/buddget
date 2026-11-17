'use client'

import { cn } from '@/lib/utils'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import type { PlanDisplay } from './planBilling'

interface Props {
  plans: readonly PlanDisplay[]
  selected: 'annual' | 'monthly'
  onSelect: (kind: 'annual' | 'monthly') => void
  disabled?: boolean
  /** Accessible name of the choice. */
  label: string
}

/**
 * The plans block of Plan and billing: yearly (gold "Best value" tag, the monthly equivalent, twelve months struck through)
 * above monthly. Prices come from `planDisplays`: the store's own when it has answered, the owner's for the region until then.
 */
export function PlansBlock({ plans, selected, onSelect, disabled, label }: Props) {
  const p = useRewardsCopy().plan
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-3">
      {plans.map((plan) => {
        const on = plan.kind === selected
        return (
          <button
            key={plan.kind}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onSelect(plan.kind)}
            data-plan={plan.kind}
            data-raw-button-ok="a plan tile: radio, two lines and the price, with the gold tag on its top edge"
            className={cn(
              'relative flex min-h-[68px] w-full items-center justify-between gap-2.5 rounded-[18px] border p-4 text-start text-[var(--color-brand-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)] disabled:opacity-60',
              on
                ? 'border-[1.5px] border-[var(--color-brand-primary)] bg-[linear-gradient(180deg,var(--color-brand-primary-soft),var(--color-brand-card))]'
                : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]',
            )}
          >
            {plan.kind === 'annual' && plan.savePct > 0 ? (
              <span dir="auto" className="absolute -top-2.5 start-3.5 rounded-full bg-[linear-gradient(112deg,var(--member-gilt-lo),var(--member-gilt-hi)_45%,var(--member-gilt-mid))] px-[9px] py-[3px] text-[0.65625rem] font-extrabold uppercase tracking-[0.06em] text-[var(--member-on-gilt)] rtl:tracking-normal">
                {p.bestValue(plan.savePct)}
              </span>
            ) : null}
            <span aria-hidden className={cn('size-5 shrink-0 rounded-full', on ? 'border-[6px] border-[var(--color-brand-primary)]' : 'border-2 border-[var(--color-brand-border)]')} />
            <span dir="auto" className="min-w-0 flex-1">
              <span className="mb-[3px] block text-[0.9375rem] font-bold">{plan.kind === 'annual' ? p.yearly : p.monthly}</span>
              <span className="block text-xs text-[var(--color-brand-text-secondary)]">
                {plan.kind === 'annual' ? (plan.perMonth ? p.perMonthBilledYearly(plan.perMonth) : '') : p.cancelAnyTime}
              </span>
            </span>
            <span dir="ltr" className="shrink-0 text-end">
              {plan.struck ? <s className="font-mono-numbers block text-xs text-[var(--color-brand-text-muted)]">{plan.struck}</s> : null}
              <b className="font-mono-numbers block text-lg font-semibold">{plan.price}</b>
            </span>
          </button>
        )
      })}
    </div>
  )
}
