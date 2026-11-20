import type { PurchasesPackage, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor'
import { getPlatform, isNative } from '@/lib/native/isNative'

/** Store keys come only from the build environment; with none set this module does nothing. */
const IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY?.trim()
const ANDROID_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY?.trim()

export const MANAGE_SUBSCRIPTION_URL = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const

/** Where the store keeps the receipts and the way to report a problem; the app only links there and never handles them. */
export const STORE_LINKS = {
  ios: { receipts: 'https://apps.apple.com/account/billing', problem: 'https://reportaproblem.apple.com' },
  android: { receipts: 'https://play.google.com/store/account/orderhistory', problem: 'https://play.google.com/store/account/orderhistory' },
} as const

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed'

/** The store's own subscription page; null on web, where nothing is sold. */
export function manageSubscriptionUrl(platform: 'ios' | 'android' | 'web' = getPlatform()): string | null {
  return platform === 'web' ? null : MANAGE_SUBSCRIPTION_URL[platform]
}

function apiKey(): string | null {
  const platform = getPlatform()
  return (platform === 'ios' ? IOS_KEY : platform === 'android' ? ANDROID_KEY : null) || null
}

/** True only where a purchase can happen: the native app with a store key for this platform. */
export function purchasesAvailable(): boolean {
  return isNative() && apiKey() !== null
}

async function sdk() {
  return (await import('@revenuecat/purchases-capacitor')).Purchases
}

// The SDK is configured once per app run; later users switch with logIn. Calling configure again replaces the shared instance.
let configured = false
let configuredFor: string | null = null
let wanted: string | null = null

/** Where the store SDK stands: `starting` until configure or logIn settles, `failed` when it threw. Screens wait on `ready`. */
export type PurchasesStatus = 'idle' | 'starting' | 'ready' | 'failed'
let status: PurchasesStatus = 'idle'
const listeners = new Set<() => void>()
const setStatus = (next: PurchasesStatus) => {
  status = next
  listeners.forEach((fn) => fn())
}
export const purchasesStatus = (): PurchasesStatus => status
export function onPurchasesChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Starts the SDK as the Supabase user, or switches the open session to them. Callers gate on `billingEnabled` first. Throws when the SDK refuses. */
export async function startPurchases(userId: string): Promise<boolean> {
  const key = apiKey()
  if (!isNative() || !key) return false
  wanted = userId
  if (configured && configuredFor === userId && status === 'ready') return true
  setStatus('starting')
  try {
    const purchases = await sdk()
    if (!configured) {
      await purchases.configure({ apiKey: key, appUserID: userId })
      configured = true
    } else if (configuredFor !== userId) {
      await purchases.logIn({ appUserID: userId })
    }
    configuredFor = userId
    setStatus('ready')
    return true
  } catch (e) {
    setStatus('failed')
    throw e
  }
}

/** Runs the last start again, after a failure the screen offered Retry for. */
export async function retryPurchases(): Promise<boolean> {
  return wanted ? startPurchases(wanted).catch(() => false) : false
}

export async function stopPurchases(): Promise<void> {
  wanted = null
  setStatus('idle')
  if (configuredFor === null) return
  configuredFor = null
  try {
    await (await sdk()).logOut()
  } catch {
    // an anonymous SDK user (already logged out) throws; nothing to undo
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The current offering's packages. StoreKit can answer empty or throw on a cold start, so a miss is asked again before giving up. */
export async function loadPackages(attempts = 3, delayMs = 1500): Promise<PurchasesPackage[]> {
  for (let i = 0; i < attempts; i++) {
    if (configuredFor === null) return []
    try {
      const offerings = await (await sdk()).getOfferings()
      const found = offerings.current?.availablePackages ?? []
      if (found.length > 0) return found
    } catch (e) {
      if (i === attempts - 1) throw e
    }
    if (i < attempts - 1) await sleep(delayMs * (i + 1))
  }
  return []
}

export async function purchasePackage(aPackage: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    await (await sdk()).purchasePackage({ aPackage })
    return 'purchased'
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed'
  }
}

/**
 * iOS only: buys the package with an App Store promotional offer (a stay offer, docs/launch/STORE_SETUP.md). The discount
 * must be on the product the store returned; RevenueCat signs it, then the purchase runs with it applied.
 * 'unavailable' when the store does not list the offer (another platform, or the offer is not on this product).
 */
export async function purchaseWithOffer(aPackage: PurchasesPackage, offerId: string): Promise<PurchaseOutcome | 'unavailable'> {
  if (getPlatform() !== 'ios') return 'unavailable'
  const discount = aPackage.product.discounts?.find((d) => d.identifier === offerId)
  if (!discount) return 'unavailable'
  try {
    const purchases = await sdk()
    const offer = await purchases.getPromotionalOffer({ product: aPackage.product, discount })
    if (!offer) return 'unavailable'
    await purchases.purchaseDiscountedPackage({ aPackage, discount: offer })
    return 'purchased'
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed'
  }
}

/** The Sparks packs the store can sell here: consumable products by id. A pack the store does not offer in this country is simply absent. */
export async function loadSparksProducts(ids: readonly string[]): Promise<PurchasesStoreProduct[]> {
  if (configuredFor === null || ids.length === 0) return []
  try {
    const { PRODUCT_CATEGORY } = await import('@revenuecat/purchases-capacitor')
    const { products } = await (await sdk()).getProducts({ productIdentifiers: [...ids], type: PRODUCT_CATEGORY.NON_SUBSCRIPTION })
    return products
  } catch {
    return []
  }
}

export async function purchaseProduct(product: PurchasesStoreProduct): Promise<PurchaseOutcome> {
  try {
    await (await sdk()).purchaseStoreProduct({ product })
    return 'purchased'
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed'
  }
}

export async function restorePurchases(): Promise<'restored' | 'failed'> {
  try {
    await (await sdk()).restorePurchases()
    return 'restored'
  } catch {
    return 'failed'
  }
}

export async function openManageSubscription(): Promise<void> {
  const url = manageSubscriptionUrl()
  if (!url) return
  try {
    const { AppLauncher } = await import('@capacitor/app-launcher')
    await AppLauncher.openUrl({ url })
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}
