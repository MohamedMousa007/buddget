// Posts the corpus and the scenario cases through the real POST /api/sms/parse on the shared dev server.
// Usage: node e2e/sms/run-e2e.mjs [onlyIdPrefix]
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { readState } from './lib.mjs'

const BASE = process.env.QA_SMS_BASE ?? 'http://localhost:3100'
const st = readState()
const corpus = JSON.parse(fs.readFileSync('e2e/sms/fixtures/corpus.json', 'utf8'))
const only = process.argv[2] ?? ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// All capture times sit in the past few hours, minutes apart, so no two distinct bodies share an I5 window by accident.
let clock = Date.parse('2026-11-17T12:00:00+02:00')
const tick = (mins = 6) => new Date((clock += mins * 60_000)).toISOString()

async function post(label, { body, sender, receivedAt, eventId = randomUUID(), device = 'qa-sms-android-1', omitEventId = false }) {
  const payload = { message: body, sender, source: 'sms', receivedAt }
  if (!omitEventId) payload.eventId = eventId
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/sms/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${st.tokens[device]}` },
    body: JSON.stringify(payload),
  })
  let json = null
  try { json = await res.json() } catch { json = null }
  const row = { label, status: res.status, ms: Date.now() - t0, json, receivedAt, eventId: omitEventId ? null : eventId, device }
  console.log(label, res.status, JSON.stringify(json).slice(0, 200))
  return row
}

const out = []
const run = async (label, args) => { if (label.startsWith(only)) out.push(await post(label, args)); await sleep(400) }

// 1. Corpus, once each (AI-tier cases are called exactly once).
for (const c of corpus.cases) {
  await run(c.id, { body: c.body, sender: c.sender, receivedAt: c.receivedAt ?? tick() })
}

// 2. SMS-001: twin purchases, no capture id, 3m40s apart (bucket N and N+1).
const TWIN = 'Your CIB credit card ending with#4821 was charged for EGP 45.00 at STARBUCKS ZAMALEK on 17/11/26'
await run('E01a', { body: TWIN, sender: 'CIB', receivedAt: '2026-11-17T16:00:10+02:00', omitEventId: true })
await run('E01b', { body: TWIN, sender: 'CIB', receivedAt: '2026-11-17T16:03:50+02:00', omitEventId: true })
// Control: the same twin pair WITH capture ids.
const TWIN2 = 'Your CIB credit card ending with#4821 was charged for EGP 55.00 at COSTA ZAMALEK on 17/11/26'
await run('E02a', { body: TWIN2, sender: 'CIB', receivedAt: '2026-11-17T16:10:10+02:00' })
await run('E02b', { body: TWIN2, sender: 'CIB', receivedAt: '2026-11-17T16:13:50+02:00' })

// 3. Duplicate delivery x3: (a) same capture id retried 3 times, (b) three capture ids 20 s apart.
const DUP = 'Your CIB credit card ending with#4821 was charged for EGP 77.00 at CILANTRO DOKKI on 17/11/26'
const ev = randomUUID()
for (const n of [1, 2, 3]) await run(`E03-retry${n}`, { body: DUP, sender: 'CIB', receivedAt: '2026-11-17T16:20:00+02:00', eventId: ev })
const DUP2 = 'Your CIB credit card ending with#4821 was charged for EGP 88.00 at BEANO MAADI on 17/11/26'
for (const [n, s] of [[1, '00'], [2, '20'], [3, '40']]) await run(`E04-copy${n}`, { body: DUP2, sender: 'CIB', receivedAt: `2026-11-17T16:30:${s}+02:00` })
// (c) balance-bearing body, three capture ids: must collapse to one.
const DUP3 = 'Your Debit Card ***9044 had a Successful transaction of EGP 99.00 @ KOSHARY ABOU TAREK, your available balance is EGP 11,111.10'
for (const [n, s] of [[1, '00'], [2, '20'], [3, '40']]) await run(`E05-bal${n}`, { body: DUP3, sender: 'QNB', receivedAt: `2026-11-17T16:40:${s}+02:00` })

// 4. Own-transfer pairing. (a) HSBC 3307 -> CIB 7310, same phone, same IPN reference.
const OUT_A = 'Account ***3307 was debited with IPN outward transfer for EGP 2,500.00 on 17-11-2026 17:00 to QA SYNTH TESTER with reference QA55PAIR01'
const IN_A = 'تم تنفيذ تحويل لحظي بمبلغ 2500 جم إلى حسابك المنتهي بـ ***7310 من QA SYNTH TESTER برقم مرجعي QA55PAIR01 بتاريخ 17-11-2026'
await run('E06-out', { body: OUT_A, sender: 'HSBC', receivedAt: '2026-11-17T17:00:05+02:00' })
await run('E06-in', { body: IN_A, sender: 'CIB', receivedAt: '2026-11-17T17:00:20+02:00' })
// (b) same shape, legs captured by two phones.
const OUT_B = 'Account ***3307 was debited with IPN outward transfer for EGP 3,100.00 on 17-11-2026 17:30 to QA SYNTH TESTER with reference QA55PAIR02'
const IN_B = 'تم تنفيذ تحويل لحظي بمبلغ 3100 جم إلى حسابك المنتهي بـ ***7310 من QA SYNTH TESTER برقم مرجعي QA55PAIR02 بتاريخ 17-11-2026'
await run('E07-out', { body: OUT_B, sender: 'HSBC', receivedAt: '2026-11-17T17:30:05+02:00' })
await run('E07-in', { body: IN_B, sender: 'CIB', receivedAt: '2026-11-17T17:30:20+02:00', device: 'qa-sms-iphone-1' })
// (c) legs arrive out of order (credit first).
const OUT_C = 'Account ***3307 was debited with IPN outward transfer for EGP 1,700.00 on 17-11-2026 18:00 to QA SYNTH TESTER with reference QA55PAIR03'
const IN_C = 'تم تنفيذ تحويل لحظي بمبلغ 1700 جم إلى حسابك المنتهي بـ ***7310 من QA SYNTH TESTER برقم مرجعي QA55PAIR03 بتاريخ 17-11-2026'
await run('E08-in', { body: IN_C, sender: 'CIB', receivedAt: '2026-11-17T18:00:20+02:00' })
await run('E08-out', { body: OUT_C, sender: 'HSBC', receivedAt: '2026-11-17T18:00:05+02:00' })

// 5. Same reference, different amounts (must not pair as one movement).
await run('E09a', { body: 'Account ***3307 was debited with IPN outward transfer for EGP 600.00 on 17-11-2026 18:30 to QA OTHER PERSON with reference QA55SAME01', sender: 'HSBC', receivedAt: '2026-11-17T18:30:00+02:00' })
await run('E09b', { body: 'Account ***3307 was debited with IPN outward transfer for EGP 60.00 on 17-11-2026 18:31 to QA OTHER PERSON with reference QA55SAME01', sender: 'HSBC', receivedAt: '2026-11-17T18:31:00+02:00' })

fs.writeFileSync('e2e/sms/out/e2e-responses.json', JSON.stringify(out, null, 2))
console.log('posted', out.length)
