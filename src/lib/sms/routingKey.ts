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
 * Words of the message skeleton that form the body-shape key.
 *
 * Four is the point where the leading boilerplate ends and the varying part begins across
 * the real corpus: "Internal incoming transfer Amount:1000SR From:A ALABOUDI" is stable for
 * four words and leaks the sender's initial at six. Fewer words merge more templates into
 * one bucket, which is harmless for matching but spends the 10-per-key learning cap faster.
 */
const SHAPE_WORDS = 4

/**
 * Last-resort grouping key derived from the message's own wording.
 *
 * The iOS Shortcuts bridge POSTs `sender=""`, and a wallet notification like
 * "Adding money to account / Amount: 400 SAR / Via: *tion" carries no hotline and no bank
 * name the AI can name either — so hotline, sender and bank all come back null and template
 * learning is skipped entirely. Every one of those messages is nonetheless a fixed template
 * with the numbers swapped, so the wording IS the identity.
 *
 * The skeleton discards every token that carries a digit and keeps the leading words that
 * remain. Discarding the whole token matters: merely stripping the digits out of "20JUL26"
 * leaves "jul", so the same template keys differently in July and August. Opaque and
 * non-asserting, exactly like the hotline key — a wrong bucket just fails the template regex
 * and falls through to the next tier, so grouping too loosely costs a wasted regex test and
 * nothing else.
 *
 * ponytail: leading words only, no stemming, no similarity search. Two templates that agree
 * that far land in one bucket and are told apart by their regexes.
 */
export function bodyShapeKey(message: string): string | null {
  const words = message
    .toLowerCase()
    // Split on punctuation as well as whitespace. Splitting on whitespace alone keeps
    // "From:A" and "عبر:9379;مدى-ابل" as single tokens, so a sender initial or a card number
    // welded to a label decides the key and two instances of one template never agree.
    .split(/[^\p{L}\p{N}]+/u)
    // Amounts, dates, masked accounts and reference numbers all carry a digit and all vary
    // per transaction. The wording around them does not.
    .filter((w) => w && !/\p{N}/u.test(w))
    .slice(0, SHAPE_WORDS)
  if (words.length < 3) return null
  return `BODY-${fnv1a(words.join(' '))}`
}

/** FNV-1a, hex. A grouping key needs stability and speed, not collision resistance. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Candidate keys to look up Tier-2 templates with, before the AI tier runs (so
 * `bank_name` isn't known yet). Transport sender + body hotline + body shape, normalized
 * and de-duplicated, empties dropped. Querying `sender IN (candidates)` lets an
 * Android SMS (real sender) and an iOS SMS (hotline or shape) match the same template
 * whichever key it was learned under.
 */
export function lookupKeys(sender: string | null | undefined, message: string): string[] {
  const keys = new Set<string>()
  const s = sender?.trim() ? normalizeSender(sender) : null
  if (s) keys.add(s)
  const h = detectHotline(message)
  if (h) keys.add(h)
  const b = bodyShapeKey(message)
  if (b) keys.add(b)
  return [...keys]
}

/**
 * Canonical key a learned template is stored under. Hotline first so iOS and
 * Android converge into the same bucket; then transport sender; then the
 * AI-detected bank name; then the message's own shape, which is available even when a
 * sender-less notification names no institution at all. Null only for a message too short
 * to have a shape.
 */
export function effectiveSender(
  sender: string | null | undefined,
  message: string,
  bankName?: string | null,
): string | null {
  return (
    detectHotline(message) ??
    (sender?.trim() ? normalizeSender(sender) : null) ??
    (bankName?.trim() ? normalizeSender(bankName) : null) ??
    bodyShapeKey(message)
  )
}
