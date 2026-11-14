import { createHash } from 'crypto'
import { maskPii } from '@/lib/sms/maskPii'

/**
 * The reusable shape of an SMS: every digit run masked, names (ALL-CAPS, Title-Case, Arabic), emails, phone numbers and URL paths redacted, whitespace
 * collapsed. Two messages from one template share a skeleton, so it is the unit the learning corpus keeps
 * (the message itself is removed after 30 days). A skeleton seen only once or twice is deleted with the text,
 * so what survives is wording that recurs across messages, not one person's details.
 */
export function maskSkeletonText(text: string): string {
  return maskPii(text).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 500)
}

export function smsSkeleton(body: string, senderKey: string | null): { key: string; redacted: string } | null {
  const redacted = maskSkeletonText(body)
  if (redacted.length < 8) return null
  const key = createHash('sha256').update(`${senderKey ?? ''}|${redacted.toLowerCase()}`).digest('hex').slice(0, 32)
  return { key, redacted }
}

/**
 * Leading words kept in the coarse shape. Four is where the boilerplate ends and the varying part (the merchant, the
 * sender's name) begins across the real corpus; the same finding routingKey.ts records for its body-shape key.
 */
const COARSE_WORDS = 4
/** Most numeric slots counted; beyond this a message is a statement or a list, and the exact count is noise. */
const MAX_SLOTS = 9

/**
 * A coarse shape: the sender key, the first few words of the masked text (tokens that carry a digit or a mask
 * placeholder are skipped) and how many numeric slots the message has. Unlike {@link smsSkeleton}, which changes with
 * every merchant and every "1,234.50" versus "50", this is the same for all messages of one bank template, so it is
 * the unit to count a template's evidence in. It is a grouping key only: two templates that share it are still told
 * apart by their regexes, and nothing is rejected or parsed on this key alone.
 */
export function coarseShapeKey(body: string, senderKey: string | null): string | null {
  const masked = maskSkeletonText(body).toLowerCase()
  const words = masked
    .split(/[^\p{L}\p{N}#<>]+/u)
    .filter((w) => w && !/[\p{N}#<>]/u.test(w))
    .slice(0, COARSE_WORDS)
  if (words.length < 3) return null
  // One slot per run of digits and the separators inside a number or date ("#,#.#", "#/#/#", "#:#").
  const slots = Math.min((masked.match(/#+(?:[.,:\/-]#+)*/g) ?? []).length, MAX_SLOTS)
  return createHash('sha256').update(`${senderKey ?? ''}|${words.join(' ')}|${slots}`).digest('hex').slice(0, 32)
}
