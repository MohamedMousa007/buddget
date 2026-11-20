// BDG-011 slice 2 (migration 0338): one charge per user message, through the real route and PostgREST.
// One fresh synthetic user (qa-e2e-turns-<ts>@buddget-qa.test), deleted at the end. Prints statuses and counts only.
// Needs the 3100 dev server and GEMINI_API_KEY on it. Usage: node e2e/api/buddgy-turns.mjs
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const BASE = process.env.QA_BASE ?? 'http://localhost:3100'
const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
const SB = env.NEXT_PUBLIC_SUPABASE_URL
const admin = { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' }
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`) }
const rows = async (table, query) => (await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: admin })).json()

const email = `qa-e2e-turns-${Date.now()}@buddget-qa.test`
const password = randomBytes(18).toString('base64url')
const created = await (await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const uid = created.id
if (!uid) throw new Error('could not create the synthetic user')

try {
  const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
  const turn = async (body) => {
    const r = await fetch(`${BASE}/api/buddgy/turn`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: 'Say hello in three words.' }], context: 'now', locale: 'en', ...body }),
    })
    const text = await r.text()
    const frames = text.split('\n\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))
    // The server settles after the last frame; give it a moment to write.
    await new Promise((res) => setTimeout(res, 1500))
    return { status: r.status, last: frames.at(-1)?.t, chatId: frames[0]?.chatId }
  }
  const events = () => rows('ai_usage_events', `user_id=eq.${uid}&select=turn_id,units,credits_exempt,status&order=id`)

  const turnId = randomUUID()
  const first = await turn({ turnId })
  check('a message with a turn id is answered', first.status === 200 && first.last === 'done', `status ${first.status}, last frame ${first.last}`)
  let ev = await events()
  check('its call is logged with the turn id', ev.length === 1 && ev[0].turn_id === turnId)
  let t = await rows('ai_turns', `user_id=eq.${uid}&turn_id=eq.${turnId}&select=state,reruns,rerun_open`)
  check('the answered turn is closed as charged', t[0]?.state === (ev[0]?.status === 'ok' ? 'charged' : 'free'), `state ${t[0]?.state}`)

  const retry = await turn({ turnId, chatId: first.chatId })
  ev = await events()
  check('Retry of the charged turn is answered', retry.status === 200, `status ${retry.status}`)
  check('Retry is the free re-run: no units, exempt', ev.length === 2 && ev[1].units === 0 && ev[1].credits_exempt === true)
  t = await rows('ai_turns', `user_id=eq.${uid}&turn_id=eq.${turnId}&select=state,reruns,rerun_open`)
  check('the shown re-run is used up', t[0]?.reruns === 1 && t[0]?.rerun_open === false, `reruns ${t[0]?.reruns}`)

  await turn({ chatId: first.chatId })
  ev = await events()
  check('a request without a turn id is billed per request', ev.length === 3 && ev[2].turn_id === null && ev[2].units > 0)

  const stuck = await rows('ai_reservations', `user_id=eq.${uid}&settled=eq.false&select=id`)
  check('no reservation left unsettled', stuck.length === 0, `${stuck.length} left`)
} finally {
  await fetch(`${SB}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: admin })
  const left = await (await fetch(`${SB}/auth/v1/admin/users?per_page=1000`, { headers: admin })).json()
  const n = (left.users ?? []).filter((u) => u.email?.startsWith('qa-e2e-turns-')).length
  check('synthetic users deleted', n === 0, `${n} left`)
}
console.log(`${results.filter(Boolean).length}/${results.length} passed`)
process.exitCode = results.every(Boolean) ? 0 : 1
