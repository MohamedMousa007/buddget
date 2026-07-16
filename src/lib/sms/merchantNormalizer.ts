import { findBrandByKey, resolveBrandKeyFromMerchant } from '@/lib/constants/subscriptionCatalog'
import type { SmsExpenseKind } from './createSmsExpense'

/**
 * Kinds whose title is a real merchant string. Everything else is a phrase composed by
 * `buildCleanTitle` ("Transfer to Ahmed", "ATM Withdrawal — CIB") which must never be
 * brand-resolved — a counterparty called "Osama" is not OSN+.
 */
const PURCHASE_KINDS: ReadonlySet<string> = new Set(['purchase', 'online_purchase'])

/** Leading processor verbs banks prepend to the actual merchant. */
const LEADING_NOISE = /^(POS|POS\s+PURCHASE|PURCHASE(\s+AT)?|PAYMENT\s+TO|WEB)\s+/i
/** Trailing reference/phone runs, e.g. "NETFLIX.COM 866-579-7172". */
const TRAILING_REF = /\s+\d[\d\s-]{5,}$/

function isAllCaps(s: string): boolean {
  return /[A-Z]/.test(s) && !/[a-z]/.test(s)
}

function titleCase(s: string): string {
  return s.replace(/[A-Za-z0-9]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

/**
 * Cosmetic only — never changes which merchant this is, just how it reads.
 * Title-casing is gated on the string being ALL CAPS so a name the bank already cased
 * ("EL Wahat for oil") is left exactly as the user knows it, and Arabic is untouched.
 */
function tidy(s: string): string {
  const out = s
    .replace(LEADING_NOISE, '')
    .replace(/\s*\*+\s*/g, ' ') // "UBER* TRIP" -> "UBER TRIP"
    .replace(TRAILING_REF, '')
    .replace(/\s+/g, ' ')
    .trim()
  return isAllCaps(out) ? titleCase(out) : out
}

/**
 * Turns a raw SMS merchant string into what the user should read.
 *
 * "Netflix.com" -> "Netflix"; "LA ROSE PASTRY" -> "La Rose Pastry".
 *
 * Deterministic — no AI. Until now only the Gemini tier produced a normalised name
 * (`merchantNormalized`), while the curated and learned-template tiers — the common,
 * fast paths — stored whatever the regex captured, because `buildCleanTitle`'s default
 * branch returns the counterparty verbatim.
 *
 * Falls back to the input rather than ever returning empty: a raw name beats no name.
 */
export function normalizeMerchant(
  raw: string | null | undefined,
  kind: SmsExpenseKind,
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (PURCHASE_KINDS.has(kind ?? '')) {
    const brand = findBrandByKey(resolveBrandKeyFromMerchant(trimmed))
    if (brand) return brand.name
  }

  return tidy(trimmed) || trimmed
}
