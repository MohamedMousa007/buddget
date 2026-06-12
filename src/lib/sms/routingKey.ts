/**
 * Effective-sender derivation for the SMS parse pipeline.
 *
 * Tier-2 learned templates and AI pattern-learning are keyed by `sender`, but
 * the iOS Shortcuts bridge POSTs `sender=""` (it can't read the SMS sender).
 * To keep those tiers working without a transport sender we derive a stable
 * routing key from the message body — primarily the bank hotline number, which
 * Egyptian/Gulf bank SMS almost always include.
 *
 * The hotline key is OPAQUE (`HOTLINE-<digits>`): it is a grouping key, not an
 * assertion of which bank sent the SMS, so it sidesteps the "hotlines are a
 * phishing vector" caveat — a wrong key simply fails the template regex and
 * falls through to the next tier.
 */
import { normalizeSender } from '@/lib/sms/patterns'

/**
 * Known bank hotline / short-code numbers that appear in SMS bodies. Used only
 * to recognize a number as a hotline (not to name the bank). 4–6 digit Egyptian
 * + Gulf customer-service lines.
 */
const KNOWN_HOTLINES = [
  // Egypt
  '19666', // CIB
  '19623', // NBE (documented)
  '19888', // NBE (observed on Instapay)
  '19700', // QNB Alahli
  '19123', // generic 19123-family
  '16664', // Banque Misr family
  // Gulf customer-service short codes (best-effort; opaque keys regardless)
  '8001240124', // Al Rajhi (KSA)
  '920003344',  // SNB / AlAhli (KSA)
]

const HOTLINE_RE = new RegExp(`\\b(${KNOWN_HOTLINES.join('|')})\\b`)

/**
 * Returns an opaque `HOTLINE-<digits>` key if a known hotline appears in the
 * body, else null. Stable across platforms (the body is identical on iOS and
 * Android), so templates learned from one platform match the other.
 */
export function detectHotline(message: string): string | null {
  const m = HOTLINE_RE.exec(message)
  return m ? `HOTLINE-${m[1]}` : null
}

/**
 * Candidate keys to look up Tier-2 templates with, before the AI tier runs (so
 * `bank_name` isn't known yet). Transport sender + body hotline, normalized and
 * de-duplicated, empties dropped. Querying `sender IN (candidates)` lets an
 * Android SMS (real sender) and an iOS SMS (hotline) match the same template
 * whichever key it was learned under.
 */
export function lookupKeys(sender: string | null | undefined, message: string): string[] {
  const keys = new Set<string>()
  const s = sender?.trim() ? normalizeSender(sender) : null
  if (s) keys.add(s)
  const h = detectHotline(message)
  if (h) keys.add(h)
  return [...keys]
}

/**
 * Canonical key a learned template is stored under. Hotline first so iOS and
 * Android converge into the same bucket; then transport sender; then the
 * AI-detected bank name. Null when none is available (learning is skipped).
 */
export function effectiveSender(
  sender: string | null | undefined,
  message: string,
  bankName?: string | null,
): string | null {
  return (
    detectHotline(message) ??
    (sender?.trim() ? normalizeSender(sender) : null) ??
    (bankName?.trim() ? normalizeSender(bankName) : null)
  )
}
