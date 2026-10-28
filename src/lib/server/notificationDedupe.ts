import { createHash } from 'node:crypto'

const WINDOW_MS = 5 * 60_000
export const PUSH_BODY_MAX = 120

/** Same content inside the same 5-minute window gives the same key, so a double click emits one notification and one push. */
export function contentDedupeKey(prefix: string, title: string, body: string, nowMs: number): string {
  const hash = createHash('sha1').update(`${title}\n${body}`).digest('hex').slice(0, 16)
  return `${prefix}:${hash}:${Math.floor(nowMs / WINDOW_MS)}`
}

/** What shows on a lock screen: the in-app row keeps the full text. */
export function pushBody(text: string): string {
  return text.length > PUSH_BODY_MAX ? `${text.slice(0, PUSH_BODY_MAX - 1)}…` : text
}
