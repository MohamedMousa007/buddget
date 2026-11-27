// QA Session 06: auth matrix over every non-admin route. Each request carries an empty JSON body ({}), so nothing valid is written.
// Usage: QA_PW_FILE=<path> node e2e/api/auth-matrix.mjs
import { call, signIn, tamper, forgeSub, USERS } from './lib.mjs'

const A = (await signIn('A')).access_token
const bad = { none: undefined, garbage: 'not-a-jwt', tampered: tamper(A), forgedSub: forgeSub(A, USERS.B.id) }

// [method, path]; prices/refresh is skipped on purpose (it would crawl upstream price providers).
const ROUTES = [
  ['POST', '/api/account/delete'], ['POST', '/api/ai'], ['GET', '/api/ai'], ['POST', '/api/analytics/onboarding'],
  ['POST', '/api/auth/device/check'], ['POST', '/api/auth/device/trust'], ['POST', '/api/auth/password/change'],
  ['POST', '/api/auth/second-factor'], ['POST', '/api/auth/two-factor'], ['POST', '/api/auth/welcome'],
  ['POST', '/api/billing/paywall-view'], ['POST', '/api/biometric/register'], ['DELETE', '/api/biometric/register'],
  ['POST', '/api/buddgy/turn'], ['GET', '/api/buddgy/usage'], ['POST', '/api/budget/ai'],
  ['GET', '/api/devices'], ['POST', '/api/devices'], ['PATCH', '/api/devices'],
  ['PATCH', `/api/devices/${USERS.A.id}`], ['DELETE', `/api/devices/${USERS.A.id}`],
  ['GET', '/api/entitlements/me'], ['POST', '/api/entitlements/trial'], ['POST', '/api/feedback'], ['GET', '/api/flags'],
  ['GET', '/api/notifications'], ['PATCH', '/api/notifications'], ['POST', '/api/push/register'], ['DELETE', '/api/push/register'],
  ['POST', '/api/push/send'], ['POST', '/api/receipt/scan'], ['POST', '/api/month-end'],
  ['POST', '/api/sms/ack'], ['POST', '/api/sms/confirm'], ['POST', '/api/sms/dismiss'], ['POST', '/api/sms/flag-action'],
  ['POST', '/api/sms/own-transfer'], ['POST', '/api/sms/parse'], ['POST', '/api/sms/revoke-token'], ['GET', '/api/sms/setup-token'],
  ['DELETE', '/api/sms/setup-token'], ['POST', '/api/sms/undo'], ['GET', '/api/support/board'], ['POST', '/api/support/board/1/vote'],
  ['POST', '/api/support/submit'], ['GET', '/api/support/tickets'], ['GET', '/api/support/tickets/1'], ['POST', '/api/support/tickets/1'],
  ['POST', '/api/voice/transcribe'],
  // Expected public or secret-guarded
  ['GET', '/api/health'], ['GET', '/api/health/deep'], ['GET', '/api/app-config'], ['GET', '/api/sms/health'], ['GET', '/api/auth/password-updated'],
  ['POST', '/api/auth/email-hook'], ['POST', '/api/billing/revenuecat'], ['POST', '/api/webhooks/linear'], ['POST', '/api/webhooks/resend'],
  ['POST', '/api/webhooks/sentry'], ['POST', '/api/biometric/signin'],
  ['GET', '/api/cron/data-retention'], ['GET', '/api/cron/integrations'], ['GET', '/api/cron/ios-crashes'], ['GET', '/api/cron/loyalty'],
  ['GET', '/api/cron/month-end'], ['GET', '/api/cron/notifications'], ['GET', '/api/cron/prices'], ['GET', '/api/cron/sms-canary'],
  ['GET', '/api/cron/sms-harvest'],
]

const only = process.argv[2]
for (const [method, path] of ROUTES) {
  for (const [kind, token] of Object.entries(bad)) {
    if (only && kind !== only) continue
    if (path.startsWith('/api/cron/') && kind !== 'none') {
      // Cron: a user JWT must not pass either.
      await call(`${kind.padEnd(9)} ${method} ${path}`, { method, path, headers: { Authorization: `Bearer ${A}` } })
      break
    }
    await call(`${kind.padEnd(9)} ${method} ${path}`, { method, path, token, body: method === 'GET' ? undefined : {} })
  }
}
