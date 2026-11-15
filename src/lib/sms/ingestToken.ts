import { createHash, randomUUID } from 'node:crypto'

/** Only this hash is stored (`sms_ingest_tokens.token_hash`); the token itself exists on the phone and in the one response that issued it. */
export const hashIngestToken = (token: string): string => createHash('sha256').update(token.trim().toLowerCase()).digest('hex')

/** A fresh token (UUID shape, as the native writer expects) with the hash to store. */
export function newIngestToken(): { token: string; token_hash: string } {
  const token = randomUUID()
  return { token, token_hash: hashIngestToken(token) }
}
