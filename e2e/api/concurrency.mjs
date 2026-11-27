// QA Session 06: duplicate, concurrent and rate-limit probes. Writes only to synthetic users qa-api-1 / qa-api-3.
// Usage: QA_PW_FILE=<path> node e2e/api/concurrency.mjs <step>
import { call, signIn, USERS } from './lib.mjs'

const step = process.argv[2]
const tally = (rs) => rs.reduce((m, r) => ((m[`${r.status} ${r.json?.status ?? r.json?.error ?? ''}`.trim()] = (m[`${r.status} ${r.json?.status ?? r.json?.error ?? ''}`.trim()] ?? 0) + 1), m), {})
const quiet = async (path, init) => {
  const { BASE } = await import('./lib.mjs')
  const r = await fetch(`${BASE}${path}`, init)
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j }
}
const auth = (t, extra = {}) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...extra })

if (step === 'trial') {
  // 12 concurrent trial claims for one user: exactly one may be granted.
  const C = (await signIn('C')).access_token
  const rs = await Promise.all(Array.from({ length: 12 }, () => quiet('/api/entitlements/trial', { method: 'POST', headers: auth(C), body: '{}' })))
  console.log('12x parallel POST /api/entitlements/trial', JSON.stringify(tally(rs)))
  const again = await quiet('/api/entitlements/trial', { method: 'POST', headers: auth(C), body: '{}' })
  console.log('then once more', again.status, JSON.stringify(again.json))
  const me = await quiet('/api/entitlements/me', { headers: auth(C) })
  console.log('entitlements/me', me.status, JSON.stringify(me.json).slice(0, 300))
}

if (step === 'paywall') {
  // No rate limit on paywall-view: 40 parallel calls with garbage bodies.
  const A = (await signIn('A')).access_token
  const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => quiet('/api/billing/paywall-view', { method: 'POST', headers: auth(A), body: i % 2 ? '{"platform":"web","source":"qa"}' : 'not json' })))
  console.log('40x parallel POST /api/billing/paywall-view', JSON.stringify(tally(rs)))
}

if (step === 'checkemail') {
  // 35 sequential lookups of a synthetic address from one IP: limit is 30/min.
  const rs = []
  for (let i = 0; i < 35; i++) rs.push(await quiet('/api/auth/check-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: USERS.B.email }) }))
  console.log('35x POST /api/auth/check-email (synthetic B)', JSON.stringify(tally(rs)), 'first 429 at #', rs.findIndex((r) => r.status === 429) + 1)
  console.log('sample body', JSON.stringify(rs[0].json))
}

if (step === 'setuptoken') {
  // 10 parallel token issues (cap: 3 active per device scope, 60 issues/hour).
  const A = (await signIn('A')).access_token
  const rs = await Promise.all(Array.from({ length: 10 }, () => quiet('/api/sms/setup-token', { headers: auth(A) })))
  console.log('10x parallel GET /api/sms/setup-token', JSON.stringify(tally(rs)))
}

if (step === 'biometric') {
  // Unknown device secrets: per-device and per-IP limits should trip.
  const rs = []
  for (let i = 0; i < 25; i++) rs.push(await quiet('/api/biometric/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: '00000000-0000-4000-8000-00000000qa06'.slice(0, 36), secret: 'x'.repeat(64) }) }))
  console.log('25x POST /api/biometric/signin (unknown device)', JSON.stringify(tally(rs)), 'first 429 at #', rs.findIndex((r) => r.status === 429) + 1)
}

if (step === 'edges') {
  const A = (await signIn('A')).access_token
  const ids = Array.from({ length: 201 }, () => crypto.randomUUID())
  await call('PATCH notifications 201 ids', { method: 'PATCH', path: '/api/notifications', token: A, body: { ids } })
  await call('PATCH notifications markAllRead', { method: 'PATCH', path: '/api/notifications', token: A, body: { markAllRead: true } })
  await call('PUT notifications (no handler)', { method: 'PUT', path: '/api/notifications', token: A, body: {} })
  await call('GET sms/parse (no handler)', { path: '/api/sms/parse', token: A })
  await call('GET support/tickets/abc', { path: '/api/support/tickets/abc', token: A })
  await call('GET support/tickets/-1', { path: '/api/support/tickets/-1', token: A })
  await call('GET support/tickets/99999999999999999999', { path: '/api/support/tickets/99999999999999999999', token: A })
  await call('PATCH devices/not-a-uuid', { method: 'PATCH', path: '/api/devices/not-a-uuid', token: A, body: { label: 'x' } })
  await call('DELETE devices/not-a-uuid', { method: 'DELETE', path: '/api/devices/not-a-uuid', token: A })
  await call('POST month-end bad id', { method: 'POST', path: '/api/month-end', token: A, body: { op: 'apply', id: 'not-a-uuid', version: 1 } })
  await call('POST month-end split over 100', { method: 'POST', path: '/api/month-end', token: A, body: { op: 'split', split: [{ target_id: '00000000-0000-4000-8000-000000000001', pct: 101 }] } })
  await call('POST month-end propose', { method: 'POST', path: '/api/month-end', token: A, body: { op: 'propose' } })
  await call('POST support/board/abc/vote', { method: 'POST', path: '/api/support/board/abc/vote', token: A, body: { vote: true } })
  await call('POST sms/confirm logId=B-like random', { method: 'POST', path: '/api/sms/confirm', token: A, body: { logId: crypto.randomUUID() } })
  await call('POST sms/confirm logId not uuid', { method: 'POST', path: '/api/sms/confirm', token: A, body: { logId: "1' or '1'='1" } })
  await call('POST sms/undo random id', { method: 'POST', path: '/api/sms/undo', token: A, body: { logId: crypto.randomUUID() } })
  await call('POST sms/dismiss random id', { method: 'POST', path: '/api/sms/dismiss', token: A, body: { logId: crypto.randomUUID() } })
  await call('GET entitlements/me', { path: '/api/entitlements/me', token: A })
  await call('GET flags', { path: '/api/flags', token: A })
  await call('GET buddgy/usage', { path: '/api/buddgy/usage', token: A })
  await call('GET devices', { path: '/api/devices', token: A })
  await call('GET notifications', { path: '/api/notifications', token: A })
  await call('GET support/tickets', { path: '/api/support/tickets', token: A })
  await call('GET support/board', { path: '/api/support/board', token: A })
  await call('GET rates', { path: '/api/rates' })
  await call('GET gold', { path: '/api/gold' })
  await call('GET rates?base=../../etc', { path: '/api/rates?base=..%2F..%2Fetc&symbols=' + 'X,'.repeat(500) })
}
