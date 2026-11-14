/**
 * A credit that names a stored-value brand the user has not registered (finding N9, second half). Detection only: the
 * row is booked as income exactly as before and carries the flag `wallet_unregistered`; a later step asks.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import { PAYMENT_BRANDS, decomposePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'

const MIN_SPELLING_CHARS = 4

const spellingsOf = (id: string): string[] => {
  const b = PAYMENT_BRANDS[id]
  // A brand you can also buy from or phone through ("Vodafone", "Careem") is named for other reasons: only its full names count.
  const names = b.alsoMerchant ? [b.name, b.full] : [b.name, b.full, ...(b.aliases ?? [])]
  return names.filter((t): t is string => !!t && t.length >= MIN_SPELLING_CHARS)
}

const namesSpelling = (body: string, spelling: string): boolean =>
  new RegExp(`(^|\\W)${spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i').test(body)

/** The catalogue wallet brand `body` names that is not among `ownBrandKeys`, or null. Pass-through brands never count. */
export function unregisteredWalletBrand(body: string | null | undefined, ownBrandKeys: ReadonlySet<string>): string | null {
  if (!body) return null
  for (const [id, b] of Object.entries(PAYMENT_BRANDS)) {
    if (b.type !== 'wallet' || b.passThrough || ownBrandKeys.has(id)) continue
    if (spellingsOf(id).some((s) => namesSpelling(body, s))) return id
  }
  return null
}

export async function namesUnregisteredWallet(service: ServiceClient, userId: string, body: string | null | undefined): Promise<boolean> {
  if (!body) return false
  const { data } = await service.from('payment_methods').select('name, last4').eq('user_id', userId).is('deleted_at', null)
  const own = new Set<string>()
  for (const m of data ?? []) {
    const key = resolvePaymentBrandKey(decomposePaymentMethodName(((m.name as string | null) ?? '').trim(), (m.last4 as string | null) ?? undefined).provider) ?? resolvePaymentBrandKey(m.name as string | null)
    if (key) own.add(key)
  }
  return unregisteredWalletBrand(body, own) !== null
}
