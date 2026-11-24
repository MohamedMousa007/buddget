// BUD-104 / QA-32 / BUD-42 (PR #38): one SMS that states two movements in one curated wording is booked as two
// transactions, each with its own claim; resending the same message (a phone retry) books nothing new. A message no
// curated pattern can cut but that states two movements is held for the user ("multi_amount") and never learned.
// Two copies of one text caught by the same phone seconds apart (Shortcut path, no sender) are booked and flagged as
// "caught twice", never dropped. Self-contained: own synthetic qa-e2e-* user, real POST /api/sms/parse, deleted at the end.
// Usage: node e2e/sms/multi-split.mjs   (QA_SMS_BASE defaults to http://localhost:3100; needs GEMINI_API_KEY for case 3)
import { createHash, randomUUID } from 'node:crypto'
import { admin } from './lib.mjs'

const BASE = process.env.QA_SMS_BASE ?? 'http://localhost:3100'
const db = admin()
const email = `qa-e2e-sms-split-${Date.now().toString(36)}@buddget-qa.test`
const DEVICE = 'qa-split-iphone'
const failures = []
const check = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (!cond) failures.push(label) }

const { data: created, error } = await db.auth.admin.createUser({ email, password: randomUUID() + 'Aa1!', email_confirm: true })
if (error) throw error
const userId = created.user.id

try {
  const { error: e1 } = await db.from('user_devices').insert({ user_id: userId, device_id: DEVICE, platform: 'ios', model: 'QA iPhone', name: DEVICE, collects_sms: true })
  if (e1) throw e1
  const token = randomUUID()
  const { error: e2 } = await db.from('sms_ingest_tokens').insert({ user_id: userId, device_id: DEVICE, token_hash: createHash('sha256').update(token.toLowerCase()).digest('hex'), is_active: true })
  if (e2) throw e2

  const post = async (message, receivedAt, eventId = randomUUID(), sender = 'HSBC') => {
    const res = await fetch(`${BASE}/api/sms/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, ...(sender ? { sender } : {}), source: 'sms', receivedAt, eventId }),
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  const expenses = async (like) => {
    const { data } = await db.from('expenses').select('id, amount, description, sms_log_id').eq('user_id', userId).is('deleted_at', null).ilike('description', like)
    return data ?? []
  }
  const logs = async (since) => {
    const { data } = await db.from('sms_parse_log').select('id, status, parse_method, confidence, failure_code, awaiting_confirmation, expense_id, learn_status, learn_template_id, sms_flags, is_duplicate').eq('user_id', userId).gte('created_at', since)
    return data ?? []
  }

  // 1. Split: two curated statements (patterns.test.ts "splitCuratedSegments (QA-32)").
  const TWO = 'Your HSBC Account ***3307 was debited EGP 100.00 for purchase at QAUBER on 16-11-2026 08:00. Account ***3307 was debited EGP 250.00 for purchase at QASTARBUCKS on 16-11-2026 08:30'
  const at1 = '2026-11-16T08:31:00+02:00'
  const ev = randomUUID()
  const r1 = await post(TWO, at1, ev)
  check('two-movement SMS accepted with two segments', r1.status === 200 && Array.isArray(r1.body?.segments) && r1.body.segments.length === 2, JSON.stringify(r1.body))
  let uber = await expenses('%QAUBER%')
  let star = await expenses('%QASTARBUCKS%')
  check('first movement booked once (100)', uber.length === 1 && Number(uber[0].amount) === 100, JSON.stringify(uber))
  check('second movement booked once (250)', star.length === 1 && Number(star[0].amount) === 250, JSON.stringify(star))
  check('each movement has its own SMS log row', uber[0]?.sms_log_id && star[0]?.sms_log_id && uber[0].sms_log_id !== star[0].sms_log_id)

  // 2. Resend: the phone retries the same message (same capture id). A new capture id is a new purchase by design (QA-31).
  const r2 = await post(TWO, at1, ev)
  check('retry with the same event id answers ok', r2.status === 200, JSON.stringify(r2.body))
  uber = await expenses('%QAUBER%')
  star = await expenses('%QASTARBUCKS%')
  check('retry booked no duplicate of the first movement', uber.length === 1, `got ${uber.length}`)
  check('retry booked no duplicate of the second movement', star.length === 1, `got ${star.length}`)

  // 3. Unsplittable multi-amount: no curated pattern reads it, two statements in one wording -> held, never learned.
  const since3 = new Date().toISOString()
  const MULTI = 'Dear Customer, your NBE card ending 4455 was used for a purchase of EGP 120.00 at QA SHOP NORTH on 16/11/2026. Dear Customer, your NBE card ending 4455 was used for a purchase of EGP 80.00 at QA SHOP SOUTH on 16/11/2026.'
  const r4 = await post(MULTI, '2026-11-16T09:00:00+02:00', randomUUID(), 'NBE')
  const l4 = (await logs(since3))
  const held = l4.find((l) => l.failure_code === 'multi_amount')
  check('unsplittable multi-amount SMS is held for review', r4.body?.held === true && r4.body?.reason === 'multi_amount' && !!held && held.awaiting_confirmation === true, JSON.stringify({ body: r4.body, l4 }))
  check('held multi-amount SMS booked no expense', (await expenses('%QA SHOP%')).length === 0 && !held?.expense_id)
  check('held multi-amount SMS was not learned', !!held && held.learn_template_id === null && (held.learn_status === null || String(held.learn_status).startsWith('skipped')), JSON.stringify(held))

  // 4. Caught twice: the same text from the same phone, no sender, 10 s apart -> both booked, the later flagged.
  const since4 = new Date().toISOString()
  const ONE = 'Account ***3307 was debited EGP 45.00 for purchase at QATWINCAFE on 16-11-2026 10:00.'
  const a = await post(ONE, '2026-11-16T10:00:05+02:00', randomUUID(), null)
  const b = await post(ONE, '2026-11-16T10:00:15+02:00', randomUUID(), null)
  check('both captures answered ok', a.status === 200 && b.status === 200, JSON.stringify([a.body, b.body]))
  const twins = await expenses('%QATWINCAFE%')
  check('second capture booked, not dropped', twins.length === 2, `got ${twins.length}`)
  const l5 = await logs(since4)
  check('later capture flagged as a possible duplicate caught by the same phone', l5.some((l) => (l.sms_flags ?? []).includes('possible_duplicate') && (l.sms_flags ?? []).some((f) => /same_phone/.test(f))), JSON.stringify(l5.map((l) => l.sms_flags)))
} finally {
  const { error: e } = await db.auth.admin.deleteUser(userId)
  if (e) console.error('teardown failed for', userId, e.message)
  const { count } = await db.from('sms_parse_log').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  console.log('synthetic rows left:', count ?? 'unknown')
}

if (failures.length) { console.error(`${failures.length} failed`); process.exit(1) }
console.log('multi-split: all passed')
