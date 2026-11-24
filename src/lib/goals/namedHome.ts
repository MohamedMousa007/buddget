import { PAYMENT_BRANDS, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethod } from '@/lib/store/types'

const GENERIC = new Set(['my', 'the', 'bank', 'account', 'main', 'current', 'saving', 'savings', 'card', 'wallet', 'بنك', 'البنك', 'حساب'])
const OUTSIDE = /\b(somewhere else|elsewhere|not tracked|outside (the |my )?(app|accounts?))\b|مكان (آخر|اخر|تاني)|خارج الحسابات|مش في (أي|اي) حساب/i
const ARABIC = /[؀-ۿ]/

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim()

/** The names a user may call an account by: its name and label, its first word, and its catalogue brand's names. */
function termsOf(m: PaymentMethod): string[] {
  const own = [m.name, m.label].filter((t): t is string => Boolean(t))
  const brand = resolvePaymentBrandKey(m.name)
  const b = brand ? PAYMENT_BRANDS[brand] : null
  const first = words(m.name).split(' ')[0] ?? ''
  return [...own, ...(b ? [b.name, b.full, ...(b.aliases ?? [])] : []), ...(first.length >= 3 ? [first] : [])]
    .filter((t): t is string => Boolean(t))
    .map(words)
    .filter((t) => t.length >= 3 && !GENERIC.has(t))
}

/** Accounts the text names, by whole word (Latin) or substring (Arabic, which takes attached prefixes). */
export function accountsNamedIn(text: string, accounts: readonly PaymentMethod[]): PaymentMethod[] {
  const padded = ` ${words(text)} `
  return accounts.filter((m) => termsOf(m).some((t) => (ARABIC.test(t) ? padded.includes(t) : padded.includes(` ${t} `))))
}

/**
 * What the user said about where money is, newest message first: the first message that names a tracked account or
 * says "somewhere else" decides. Only user-written text is read, never the model's.
 */
export function userNamedHome(userTexts: readonly string[] | undefined, accounts: readonly PaymentMethod[]): { named: PaymentMethod[]; outside: boolean } {
  for (const text of userTexts ?? []) {
    const named = accountsNamedIn(text, accounts)
    const outside = OUTSIDE.test(text)
    if (named.length > 0 || outside) return { named, outside }
  }
  return { named: [], outside: false }
}
