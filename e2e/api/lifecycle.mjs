// QA Session 06: account deletion end to end on qa-api-3, then the deleted user's still-unexpired JWT against routes
// that verify the JWT locally (resolveApiUserId / resolveRouteIdentity) versus routes that ask Auth or check the account is active.
// Usage: QA_PW_FILE=<path> node e2e/api/lifecycle.mjs
import { call, signIn } from './lib.mjs'

const C = (await signIn('C')).access_token
await call('C POST /api/account/delete (fresh password sign-in)', { method: 'POST', path: '/api/account/delete', token: C, body: {} })
await call('C POST /api/account/delete again (double submit)', { method: 'POST', path: '/api/account/delete', token: C, body: {} })
// Deleted user's JWT (exp ~1 h) from here on.
await call('deleted C GET /api/notifications', { path: '/api/notifications', token: C })
await call('deleted C GET /api/entitlements/me', { path: '/api/entitlements/me', token: C })
await call('deleted C GET /api/flags', { path: '/api/flags', token: C })
await call('deleted C GET /api/support/board', { path: '/api/support/board', token: C })
await call('deleted C GET /api/support/tickets', { path: '/api/support/tickets', token: C })
await call('deleted C POST analytics/onboarding', { method: 'POST', path: '/api/analytics/onboarding', token: C, body: { type: 'onboarding_started', meta: {} } })
await call('deleted C POST /api/devices', { method: 'POST', path: '/api/devices', token: C, headers: { 'X-Buddget-Device-Id': 'cccc0606-0000-4000-8000-0000000000c3' }, body: { platform: 'android' } })
await call('deleted C GET /api/sms/setup-token', { path: '/api/sms/setup-token', token: C })
await call('deleted C POST /api/entitlements/trial', { method: 'POST', path: '/api/entitlements/trial', token: C, body: {} })
await call('deleted C GET /api/buddgy/usage', { path: '/api/buddgy/usage', token: C })
await call('deleted C POST /api/month-end', { method: 'POST', path: '/api/month-end', token: C, body: { op: 'propose' } })
