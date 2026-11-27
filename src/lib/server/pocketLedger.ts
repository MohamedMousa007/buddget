import { createHash } from 'node:crypto'

/** Stable uuid from a key: the idempotency token for one logical move, so a rerun cannot apply it twice. */
export function groupIdFor(key: string): string {
  const h = createHash('sha256').update(key).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}
