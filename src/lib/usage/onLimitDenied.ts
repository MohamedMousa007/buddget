import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useUsageStore } from '@/lib/usage/usageStore'

/** The server denial layers that are a spent limit. The legacy `sparks` layer (a spent monthly allowance) reads as the session. */
export function isLimitLayer(layer: string | undefined): layer is 'session' | 'week' | 'sparks' {
  return layer === 'session' || layer === 'week' || layer === 'sparks'
}

/**
 * The one handler for a refused AI request. Chat, voice, receipts, budgets and goal estimates all end here: it records which limit
 * blocked the person (so a later open can say it is back), queues the event for the presenter, and refreshes the plan so the meters
 * are current. Nothing happens while selling is off or for a refusal that is not a limit (rate, disabled, unavailable).
 */
export function onLimitDenied(layer: string | undefined, resetAt: string | null | undefined): void {
  if (!isLimitLayer(layer) || !billingOn(useBillingStore.getState().me)) return
  const scope = layer === 'week' ? 'week' : 'session'
  const store = useUsageStore.getState()
  if (resetAt) store.setSignal('lastLimit', { scope, resetAt })
  store.push({ type: 'limit', layer: scope })
  void useBillingStore.getState().refresh()
}
