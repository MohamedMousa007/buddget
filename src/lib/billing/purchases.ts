import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { getPlatform, isNative } from '@/lib/native/isNative'

/** Store keys come only from the build environment; with none set this module does nothing. */
const IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY?.trim()
const ANDROID_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY?.trim()

export const MANAGE_SUBSCRIPTION_URL = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
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

let configuredFor: string | null = null

/** Starts the SDK as the Supabase user, or switches the open session to them. Callers gate on `billingEnabled` first. */
export async function startPurchases(userId: string): Promise<boolean> {
  const key = apiKey()
  if (!isNative() || !key) return false
  const purchases = await sdk()
  if (configuredFor === null) await purchases.configure({ apiKey: key, appUserID: userId })
  else if (configuredFor !== userId) await purchases.logIn({ appUserID: userId })
  configuredFor = userId
  return true
}

export async function stopPurchases(): Promise<void> {
  if (configuredFor === null) return
  configuredFor = null
  try {
    await (await sdk()).logOut()
  } catch {
    // an anonymous SDK user (already logged out) throws; nothing to undo
  }
}

export async function loadPackages(): Promise<PurchasesPackage[]> {
  if (configuredFor === null) return []
  const offerings = await (await sdk()).getOfferings()
  return offerings.current?.availablePackages ?? []
}

export async function purchasePackage(aPackage: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    await (await sdk()).purchasePackage({ aPackage })
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
