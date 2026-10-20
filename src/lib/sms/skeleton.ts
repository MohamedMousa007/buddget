import { createHash } from 'node:crypto'
import { redactBody } from '@/lib/sms/adjudicator'

/**
 * The reusable shape of an SMS: every digit run masked, long numbers and ALL-CAPS names redacted, whitespace
 * collapsed. Two messages from one template share a skeleton, so it is the unit the learning corpus keeps
 * (the message itself is removed after 30 days). A skeleton seen only once or twice is deleted with the text,
 * so what survives is wording that recurs across messages, not one person's details.
 */
export function smsSkeleton(body: string, senderKey: string | null): { key: string; redacted: string } | null {
  const redacted = redactBody(body).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 500)
  if (redacted.length < 8) return null
  const key = createHash('sha256').update(`${senderKey ?? ''}|${redacted.toLowerCase()}`).digest('hex').slice(0, 32)
  return { key, redacted }
}
