// S8c round 2: delete the synthetic users (cascades): qa-api-1..3 and the legacy qa-sec-1..3 ids. 404 = already gone.
// Usage: QA_PW_FILE=<same file as setup> node e2e/api/round2/teardown.mjs   (../lib.mjs reads QA_PW_FILE on import)
import { readFileSync } from 'node:fs'
import { SB_URL, USERS } from '../lib.mjs'
const env = Object.fromEntries(readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]))
const LEGACY_SEC = ['95586f55-46db-46eb-ad11-ff9395be8d7c', '126068f6-bdf9-46fe-976c-83d3552bac14', '108c5141-7d2c-4f51-b9fc-0ba725fa108b']
const all = { ...Object.fromEntries(Object.entries(USERS)), ...Object.fromEntries(LEGACY_SEC.map((id, i) => [`sec${i + 1}`, { id }])) }
for (const [k, u] of Object.entries(all)) {
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } })
  console.log('delete', k, r.status)
}
