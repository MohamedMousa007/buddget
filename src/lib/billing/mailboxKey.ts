import { createHmac } from 'node:crypto'

/**
 * The per-person mailbox key the trial and invite rules share (QA-59, migration 0324). With `TRIAL_CLAIM_KEY_SECRET` the
 * stored key is a keyed hash, and the plain normalised address is passed as `legacy` so the database can find and convert
 * a row it hashed without the key. Without the secret the database hashes the plain address (SHA-256).
 */
export function mailboxKeyArgs(normalizedEmail: string, secret = process.env.TRIAL_CLAIM_KEY_SECRET): { key: string; legacy?: string } {
  return secret ? { key: createHmac('sha256', secret).update(normalizedEmail).digest('hex'), legacy: normalizedEmail } : { key: normalizedEmail }
}
