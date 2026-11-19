// QA Session 06: runtime cross-user checks through our own API routes (builds on QA_SECURITY_REPORT, which reviewed them in code).
// Needs B's seed rows: notification bbbb0606-...-a1 and user_devices device bbbb0606-...-d1 (see QA_API_DB_REPORT.md).
// Usage: QA_PW_FILE=<path> node e2e/api/cross-user.mjs
import { call, signIn } from './lib.mjs'

const A = (await signIn('A')).access_token
const B_NOTIF = 'bbbb0606-0000-4000-8000-0000000000a1'
const B_DEVICE = 'bbbb0606-0000-4000-8000-0000000000d1'
await call('A PATCH notifications ids=[B notif]', { method: 'PATCH', path: '/api/notifications', token: A, body: { ids: [B_NOTIF] } })
await call('A PATCH devices/<B device> rename', { method: 'PATCH', path: `/api/devices/${B_DEVICE}`, token: A, body: { name: 'pwned' } })
await call('A DELETE devices/<B device>', { method: 'DELETE', path: `/api/devices/${B_DEVICE}`, token: A })
await call('A PATCH devices (main=B device)', { method: 'PATCH', path: '/api/devices', token: A, headers: { 'X-Buddget-Device-Id': B_DEVICE }, body: { isMain: true } })
await call('A POST devices with B device id', { method: 'POST', path: '/api/devices', token: A, headers: { 'X-Buddget-Device-Id': B_DEVICE }, body: { platform: 'android', name: 'A claims B id' } })
await call('A GET sms/setup-token with B device id', { path: '/api/sms/setup-token', token: A, headers: { 'X-Buddget-Device-Id': B_DEVICE } })
await call('A GET devices', { path: '/api/devices', token: A })
