import { useBillingStore } from './billingStore'
import { startPurchases } from './purchases'
import { claimTrial } from './trialClaim'

const claimedFor = new Set<string>()

/** Everything that touches the store SDK or the trial endpoint. A no-op until the server's billing switch is on. */
export async function startBillingSession(userId: string, enabled: boolean): Promise<void> {
  if (!enabled) return
  void startPurchases(userId).catch(() => undefined)
  if (claimedFor.has(userId)) return
  claimedFor.add(userId)
  if ((await claimTrial()) === 'granted') await useBillingStore.getState().refresh()
}
