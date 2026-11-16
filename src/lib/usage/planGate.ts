import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useUsageStore } from '@/lib/usage/usageStore'

/**
 * Whether creating, copying or restoring one more saved plan is refused by the plan's limit (Free keeps 2). True also queues the
 * limit sheet. The database refuses the same thing while selling is on, so a stale app cannot get around it; plans over the limit
 * after a downgrade are kept and only new ones are stopped.
 */
export function planLimitReached(): boolean {
  const me = useBillingStore.getState().me
  if (!billingOn(me)) return false
  const limit = me?.usage?.plans.limit ?? null
  if (limit === null || useFinanceStore.getState().budgetPlans.length < limit) return false
  useUsageStore.getState().push({ type: 'plan_create' })
  return true
}
