#!/usr/bin/env node
// Generates the Sign in with Apple client secret (an ES256 JWT, valid ~6 months) for Supabase's
// "Secret Key (for OAuth)" field. Runs locally; the .p8 key never leaves this machine.
// Usage:
//   node scripts/apple-client-secret.mjs --key ~/path/AuthKey_XXXX.p8 --key-id XXXX --team-id 9PK34RL9DN --client-id app.buddget.web.service
// Renew before it expires (Apple caps it at 6 months) and paste it into every Supabase project.
import { readFileSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'
import { homedir } from 'node:os'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, v, i, a) => (v.startsWith('--') ? [...pairs, [v.slice(2), a[i + 1]]] : pairs), []),
)
for (const k of ['key', 'key-id', 'team-id', 'client-id']) {
  if (!args[k]) { console.error(`missing --${k}`); process.exit(1) }
}

const b64url = (input) => Buffer.from(input).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const SIX_MONTHS = 15_777_000 // Apple's maximum lifetime in seconds

const header = { alg: 'ES256', kid: args['key-id'], typ: 'JWT' }
const payload = { iss: args['team-id'], iat: now, exp: now + SIX_MONTHS, aud: 'https://appleid.apple.com', sub: args['client-id'] }
const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`

const key = createPrivateKey(readFileSync(args.key.replace(/^~/, homedir())))
const signature = sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')

console.log(`${signingInput}.${signature}`)
console.error(`\nExpires: ${new Date((now + SIX_MONTHS) * 1000).toISOString().slice(0, 10)} (renew before then)`)
