'use client'
import { ArrowUpDown, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { findBrandByKey, plansForRegion, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { useT } from '@/lib/i18n'

/**
 * "Your Netflix looks like it moved to Premium — update?" A tracked payment matched a
 * different catalog plan (dispatch parked it on `pendingPlanId`); the user confirms or
 * dismisses. Never auto-applied — a proration or promo can look like a switch.
 */
export function SubscriptionPlanChangeBanner() {
  const t = useT()
  const { subscriptions, applyPendingPlanChange, dismissPendingPlanChange } = useFinanceStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      applyPendingPlanChange: s.applyPendingPlanChange,
      dismissPendingPlanChange: s.dismissPendingPlanChange,
    })),
  )

  const pending = subscriptions.filter((s) => s.pendingPlanId && s.status === 'active')
  if (!pending.length) return null

  return (
    <>
      {pending.map((sub) => {
        const brand = findBrandByKey(sub.brandKey)
        const plan = brand && sub.catalogRegion
          ? plansForRegion(brand, sub.catalogRegion as CatalogRegion).find((p) => p.id === sub.pendingPlanId)
          : undefined
        // If we can't name the plan the detection is unusable — drop it silently.
        if (!plan) return null
        const isUpgrade = (sub.pendingAmount ?? 0) > sub.amount

        return (
          <div
            key={sub.id}
            className="animate-in slide-in-from-top-4 fade-in rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand-text-primary)]">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-text-muted)]" />
                {(isUpgrade ? t.subscriptions.planChangeUpgrade : t.subscriptions.planChangeDowngrade)
                  .replace('{brand}', sub.name)
                  .replace('{plan}', plan.name)}
              </p>
              <button
                type="button"
                onClick={() => dismissPendingPlanChange(sub.id)}
                className="-me-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--color-brand-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
                aria-label={t.common.dismiss}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => applyPendingPlanChange(sub.id)}
              className="mt-2.5 flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)]/10 px-3 text-xs text-[var(--color-brand-green)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
            >
              {t.subscriptions.planChangeApply}
            </button>
          </div>
        )
      })}
    </>
  )
}
