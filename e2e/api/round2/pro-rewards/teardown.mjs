// S8g: deletes every synthetic user this suite may have left (email qa-e2e-pr-*@buddget-qa.test), with the rows that do not
// cascade (billing_events, trial_claims, founders, founder_candidates, referrals, admin_staff, admin_audit_log as actor).
// Prints only counts. Run: node e2e/api/round2/pro-rewards/teardown.mjs [--check]
import fs from 'node:fs'
const env = { ...process.env }
for (const f of ['.env.local', process.env.QA_ENV_FILE].filter(Boolean)) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l); if (m && !env[m[1]]) env[m[1]] = m[2] }
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const found = []
for (let page = 1; page < 60; page++) {
  const r = await (await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: H })).json()
  const users = r.users ?? []
  for (const u of users) if (/^qa-e2e-pr-.*@buddget-qa\.test$/.test(u.email ?? '')) found.push(u.id)
  if (users.length < 200) break
}
console.log('synthetic users found', found.length)
if (!process.argv.includes('--check')) {
  for (const id of found) {
    for (const p of [`billing_events?user_id=eq.${id}`, `trial_claims?user_id=eq.${id}`, `founders?user_id=eq.${id}`, `founder_candidates?user_id=eq.${id}`, `referrals?inviter_id=eq.${id}`, `referrals?invitee_id=eq.${id}`, `admin_audit_log?actor_id=eq.${id}`, `admin_staff?user_id=eq.${id}`]) await fetch(`${URL_}/rest/v1/${p}`, { method: 'DELETE', headers: H })
    await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: H })
  }
  console.log('deleted', found.length)
}
