import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { confirmWithStore, refreshUntilStore, storeConfirmed, type BillingMe } from './billingStore'
import { purchasePackage, restorePurchases, type PurchasesStatus } from './purchases'

/** What the buy button can do now: wait for the store, sell, or say buying is not available (with Retry where a retry can help). */
export type Shelf = 'loading' | 'ready' | 'unavailable'

export function shelfOf(available: boolean, sdk: PurchasesStatus, packages: PurchasesPackage[] | null): Shelf {
  if (!available || sdk === 'failed') return 'unavailable'
  if (sdk !== 'ready' || packages === null) return 'loading'
  return packages.length > 0 ? 'ready' : 'unavailable'
}

/**
 * A purchase is `confirmed` only once the server shows Pro from a store. The webhook usually lands within the short poll; when it
 * does not, the server is asked once to read RevenueCat itself, and a miss there leaves the buyer `pending` ("Confirming with the store").
 */
export async function completePurchase(pkg: PurchasesPackage, delayMs = 2000): Promise<'confirmed' | 'pending' | 'cancelled' | 'failed'> {
  const outcome = await purchasePackage(pkg)
  if (outcome !== 'purchased') return outcome
  if (await refreshUntilStore(3, delayMs)) return 'confirmed'
  return (await confirmWithStore()) ? 'confirmed' : 'pending'
}

/** `restored` only when the store's Pro shows now and did not before the tap; anything else is "Nothing to restore". */
export async function completeRestore(before: BillingMe | null): Promise<'restored' | 'nothing'> {
  if ((await restorePurchases()) === 'failed') return 'nothing'
  return (await confirmWithStore()) && !storeConfirmed(before) ? 'restored' : 'nothing'
}
