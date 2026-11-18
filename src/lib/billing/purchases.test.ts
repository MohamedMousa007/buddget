import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  native: true,
  platform: 'ios' as 'ios' | 'android' | 'web',
  sdk: { configure: vi.fn(), logIn: vi.fn(), logOut: vi.fn(), getOfferings: vi.fn(), purchasePackage: vi.fn(), restorePurchases: vi.fn(), getPromotionalOffer: vi.fn(), purchaseDiscountedPackage: vi.fn() },
}))
vi.mock('@/lib/native/isNative', () => ({ isNative: () => h.native, getPlatform: () => h.platform }))
vi.mock('@revenuecat/purchases-capacitor', () => ({ Purchases: h.sdk }))

async function load(keys: { ios?: string; android?: string }) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', keys.ios ?? '')
  vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_KEY', keys.android ?? '')
  return import('./purchases')
}

beforeEach(() => {
  Object.values(h.sdk).forEach((f) => f.mockReset())
  h.native = true
  h.platform = 'ios'
})

describe('manageSubscriptionUrl', () => {
  it('points at each store and nowhere on web', async () => {
    const m = await load({})
    expect(m.manageSubscriptionUrl('ios')).toBe('https://apps.apple.com/account/subscriptions')
    expect(m.manageSubscriptionUrl('android')).toBe('https://play.google.com/store/account/subscriptions')
    expect(m.manageSubscriptionUrl('web')).toBeNull()
  })
})

describe('the SDK stays untouched without a key or off native', () => {
  it('does nothing with no key', async () => {
    const m = await load({})
    expect(await m.startPurchases('u1')).toBe(false)
    expect(await m.loadPackages()).toEqual([])
    expect(h.sdk.configure).not.toHaveBeenCalled()
  })
  it('does nothing on web even with a key', async () => {
    h.native = false
    h.platform = 'web'
    const m = await load({ ios: 'k' })
    expect(m.purchasesAvailable()).toBe(false)
    expect(await m.startPurchases('u1')).toBe(false)
    expect(h.sdk.configure).not.toHaveBeenCalled()
  })
})

describe('with a key on a device', () => {
  it('configures once as the user, then logs in on a user change, and logs out', async () => {
    const m = await load({ ios: 'k' })
    expect(await m.startPurchases('u1')).toBe(true)
    await m.startPurchases('u1')
    await m.startPurchases('u2')
    expect(h.sdk.configure).toHaveBeenCalledTimes(1)
    expect(h.sdk.configure).toHaveBeenCalledWith({ apiKey: 'k', appUserID: 'u1' })
    expect(h.sdk.logIn).toHaveBeenCalledWith({ appUserID: 'u2' })
    await m.stopPurchases()
    expect(h.sdk.logOut).toHaveBeenCalledTimes(1)
  })

  it('after a sign-out the next user logs in instead of configuring the SDK a second time', async () => {
    const m = await load({ ios: 'k' })
    await m.startPurchases('u1')
    await m.stopPurchases()
    await m.startPurchases('u2')
    expect(h.sdk.configure).toHaveBeenCalledTimes(1)
    expect(h.sdk.logIn).toHaveBeenCalledWith({ appUserID: 'u2' })
  })

  it('purchase reports purchased, cancelled and failed', async () => {
    const m = await load({ ios: 'k' })
    const pkg = {} as never
    h.sdk.purchasePackage.mockResolvedValueOnce({})
    expect(await m.purchasePackage(pkg)).toBe('purchased')
    h.sdk.purchasePackage.mockRejectedValueOnce({ userCancelled: true })
    expect(await m.purchasePackage(pkg)).toBe('cancelled')
    h.sdk.purchasePackage.mockRejectedValueOnce(new Error('declined'))
    expect(await m.purchasePackage(pkg)).toBe('failed')
  })

  it('restore reports restored or failed', async () => {
    const m = await load({ ios: 'k' })
    h.sdk.restorePurchases.mockResolvedValueOnce({})
    expect(await m.restorePurchases()).toBe('restored')
    h.sdk.restorePurchases.mockRejectedValueOnce(new Error('x'))
    expect(await m.restorePurchases()).toBe('failed')
  })
})

describe('purchaseWithOffer (stay offers, iOS only)', () => {
  const pkg = { identifier: 'monthly', product: { identifier: 'pro_monthly', discounts: [{ identifier: 'stay30_2m' }] } } as never
  it('signs the discount on the product and buys the package with it', async () => {
    const m = await load({ ios: 'k' })
    await m.startPurchases('u1')
    h.sdk.getPromotionalOffer.mockResolvedValueOnce({ identifier: 'stay30_2m', signature: 'sig' })
    h.sdk.purchaseDiscountedPackage.mockResolvedValueOnce({})
    expect(await m.purchaseWithOffer(pkg, 'stay30_2m')).toBe('purchased')
    expect(h.sdk.getPromotionalOffer).toHaveBeenCalledWith({ product: (pkg as { product: unknown }).product, discount: { identifier: 'stay30_2m' } })
    expect(h.sdk.purchaseDiscountedPackage).toHaveBeenCalledWith({ aPackage: pkg, discount: { identifier: 'stay30_2m', signature: 'sig' } })
  })
  it('unavailable when the product lacks the offer, when signing returns nothing, or off iOS; cancelled and failed as the store says', async () => {
    const m = await load({ ios: 'k' })
    expect(await m.purchaseWithOffer(pkg, 'stay_annual_20')).toBe('unavailable')
    h.sdk.getPromotionalOffer.mockResolvedValueOnce(undefined)
    expect(await m.purchaseWithOffer(pkg, 'stay30_2m')).toBe('unavailable')
    h.sdk.getPromotionalOffer.mockResolvedValue({ identifier: 'stay30_2m' })
    h.sdk.purchaseDiscountedPackage.mockRejectedValueOnce({ userCancelled: true })
    expect(await m.purchaseWithOffer(pkg, 'stay30_2m')).toBe('cancelled')
    h.sdk.purchaseDiscountedPackage.mockRejectedValueOnce(new Error('declined'))
    expect(await m.purchaseWithOffer(pkg, 'stay30_2m')).toBe('failed')
    h.platform = 'android'
    expect(await m.purchaseWithOffer(pkg, 'stay30_2m')).toBe('unavailable')
    expect(h.sdk.purchaseDiscountedPackage).toHaveBeenCalledTimes(2)
  })
})
