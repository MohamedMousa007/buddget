import { captureAppError } from '@/lib/crash/init'
import { useBillingStore } from './billingStore'
import { startPurchases } from './purchases'
import { claimTrial } from './trialClaim'

const claimedFor = new Set<string>()

/** Everything that touches the store SDK or the trial endpoint. A no-op until the server's billing switch is on. */
export async function startBillingSession(userId: string, enabled: boolean): Promise<void> {
  if (!enabled) return
  // A refused configure is reported and leaves the SDK `failed`, which the purchase screens show with Retry.
  void startPurchases(userId).catch((e) => {
    console.error('[billing] store setup failed', e)
    captureAppError(e, 'billing.configure')
  })
  if (claimedFor.has(userId)) return
  claimedFor.add(userId)
  if ((await claimTrial()) === 'granted') await useBillingStore.getState().refresh()
}
