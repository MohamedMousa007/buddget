// BDG-008: user_devices.first_sms_at is set by the first SMS from a phone, never moved by a later one, and never touched
// by another phone's SMS. Self-contained: makes its own synthetic qa-e2e-* user, posts through the real POST
// /api/sms/parse on the dev server, and deletes the user at the end (also on failure).
// Usage: node e2e/sms/first-sms.mjs   (QA_SMS_BASE defaults to http://localhost:3100)
import { createHash, randomUUID } from 'node:crypto'
import { admin } from './lib.mjs'

const BASE = process.env.QA_SMS_BASE ?? 'http://localhost:3100'
const db = admin()
const email = `qa-e2e-sms-first-${Date.now().toString(36)}@buddget-qa.test`
const PHONES = ['qa-first-iphone-a', 'qa-first-iphone-b']
const failures = []
const check = (label, cond) => { console.log(cond ? 'ok  ' : 'FAIL', label); if (!cond) failures.push(label) }

const { data: created, error } = await db.auth.admin.createUser({ email, password: randomUUID() + 'Aa1!', email_confirm: true })
if (error) throw error
const userId = created.user.id

try {
  const tokens = {}
  for (const device_id of PHONES) {
    const { error: e1 } = await db.from('user_devices').insert({ user_id: userId, device_id, platform: 'ios', model: 'QA iPhone', name: device_id, collects_sms: true })
    if (e1) throw e1
    const token = randomUUID()
    const token_hash = createHash('sha256').update(token.toLowerCase()).digest('hex')
    const { error: e2 } = await db.from('sms_ingest_tokens').insert({ user_id: userId, device_id, token_hash, is_active: true })
    if (e2) throw e2
    tokens[device_id] = token
  }

  const post = async (device, message, receivedAt) => {
    const res = await fetch(`${BASE}/api/sms/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[device]}` },
      body: JSON.stringify({ message, sender: 'CIB', source: 'sms', receivedAt, eventId: randomUUID() }),
    })
    return res.ok
  }
  const row = async (device) => {
    const { data } = await db.from('user_devices').select('first_sms_at, last_sms_at').eq('user_id', userId).eq('device_id', device).single()
    return { first: data.first_sms_at && Date.parse(data.first_sms_at), last: data.last_sms_at && Date.parse(data.last_sms_at) }
  }

  const T1 = '2026-11-20T09:00:00+02:00'
  const T2 = '2026-11-20T11:00:00+02:00'
  const T3 = '2026-11-20T12:00:00+02:00'
  const [a, b] = PHONES

  check('first SMS from phone A accepted', await post(a, 'Your CIB credit card ending with#4821 was charged for EGP 41.00 at QA SHOP ONE on 20/11/26', T1))
  let ra = await row(a)
  check('phone A first_sms_at set by its first SMS', ra.first === Date.parse(T1) && ra.last === Date.parse(T1))
  check('phone B untouched by phone A', (await row(b)).first === null)

  check('second SMS from phone A accepted', await post(a, 'Your CIB credit card ending with#4821 was charged for EGP 42.00 at QA SHOP TWO on 20/11/26', T2))
  ra = await row(a)
  check('phone A first_sms_at did not move', ra.first === Date.parse(T1))
  check('phone A last_sms_at moved', ra.last === Date.parse(T2))

  check('SMS from phone B accepted', await post(b, 'Your CIB credit card ending with#4821 was charged for EGP 43.00 at QA SHOP THREE on 20/11/26', T3))
  check('phone B first_sms_at set by its own SMS', (await row(b)).first === Date.parse(T3))
  check('phone A unchanged by phone B', (await row(a)).first === Date.parse(T1))
} finally {
  const { error: e } = await db.auth.admin.deleteUser(userId)
  if (e) console.error('teardown failed for', userId, e.message)
  const { count } = await db.from('user_devices').select('device_id', { count: 'exact', head: true }).eq('user_id', userId)
  console.log('synthetic rows left:', count ?? 'unknown')
}

if (failures.length) { console.error(`${failures.length} failed`); process.exit(1) }
console.log('first-sms: all passed')
