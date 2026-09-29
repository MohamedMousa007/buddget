'use client'
import { ArrowUpDown } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { findBrandByKey, plansForRegion, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useT } from '@/lib/i18n'

/**
 * "Your Netflix looks like it moved to Premium — update?" A tracked payment matched a
 * different catalog plan (dispatch parked it on `pendingPlanId`); the user applies or
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

  const prompts: Prompt[] = []
  for (const sub of subscriptions) {
    if (!sub.pendingPlanId || sub.status !== 'active') continue
    const brand = findBrandByKey(sub.brandKey)
    const plan = brand && sub.catalogRegion
      ? plansForRegion(brand, sub.catalogRegion as CatalogRegion).find((p) => p.id === sub.pendingPlanId)
      : undefined
    // If we can't name the plan the detection is unusable — drop it silently.
    if (!plan) continue
    const isUpgrade = (sub.pendingAmount ?? 0) > sub.amount
    prompts.push({
      key: `plan:${sub.id}`,
      priority: PROMPT_PRIORITY.planChange,
      tone: 'brand',
      icon: ArrowUpDown,
      title: (isUpgrade ? t.subscriptions.planChangeUpgrade : t.subscriptions.planChangeDowngrade)
        .replace('{brand}', sub.name)
        .replace('{plan}', plan.name),
      actions: [
        { label: t.subscriptions.planChangeApply, variant: 'default', onPress: () => applyPendingPlanChange(sub.id) },
        { label: t.common.dismiss, variant: 'secondary', onPress: () => dismissPendingPlanChange(sub.id) },
      ],
    })
  }
  useRegisterPrompts('plan-change', prompts)

  return null
}
