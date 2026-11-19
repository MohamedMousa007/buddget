// QA Session 06: input robustness with a valid synthetic session (qa-api-1).
// Bodies are malformed JSON, wrong JSON types, an empty object and a 2 MB string, so no valid write can happen.
// Routes that would spend AI credit or crawl upstream are included only because each case fails validation first.
// Usage: QA_PW_FILE=<path> node e2e/api/input-matrix.mjs
import { call, signIn } from './lib.mjs'

const A = (await signIn('A')).access_token
const POSTS = [
  /* account/delete ignores the body and would delete qa-api-1: covered in lifecycle.mjs */ ['POST', '/api/ai'], ['POST', '/api/analytics/onboarding'], ['POST', '/api/auth/check-email'],
  ['POST', '/api/auth/device/check'], ['POST', '/api/auth/device/trust'], ['POST', '/api/auth/password/change'],
  ['POST', '/api/auth/second-factor'], ['POST', '/api/auth/two-factor'], ['POST', '/api/billing/paywall-view'],
  ['POST', '/api/biometric/register'], ['POST', '/api/biometric/signin'], ['POST', '/api/buddgy/turn'], ['POST', '/api/budget/ai'],
  ['POST', '/api/devices'], ['PATCH', '/api/devices'], ['PATCH', '/api/devices/00000000-0000-4000-8000-000000000000'],
  ['POST', '/api/feedback'], ['PATCH', '/api/notifications'], ['POST', '/api/push/register'], ['DELETE', '/api/push/register'],
  ['POST', '/api/push/send'], ['POST', '/api/receipt/scan'], ['POST', '/api/savings/carry'], ['POST', '/api/site/event'], ['POST', '/api/site/lead'],
  ['POST', '/api/sms/ack'], ['POST', '/api/sms/confirm'], ['POST', '/api/sms/dismiss'], ['POST', '/api/sms/flag-action'],
  ['POST', '/api/sms/own-transfer'], ['POST', '/api/sms/parse'], ['POST', '/api/sms/undo'], ['POST', '/api/support/board/1/vote'],
  ['POST', '/api/support/submit'], ['POST', '/api/support/tickets/1'], ['POST', '/api/voice/transcribe'],
]
const CASES = {
  malformed: { raw: '{"a":' },
  array: { raw: '[1,2,3]' },
  null: { raw: 'null' },
  string: { raw: '"x"' },
  wrongTypes: { body: { id: 12, amount: 'abc', logId: true, text: 5, message: {}, email: 7, number: [] } },
  huge: { raw: JSON.stringify({ text: 'x'.repeat(2 * 1024 * 1024), message: 'x'.repeat(10) }) },
}
const only = process.argv[2]
for (const [method, path] of POSTS) {
  for (const [kind, c] of Object.entries(CASES)) {
    if (only && kind !== only) continue
    await call(`${kind.padEnd(10)} ${method} ${path}`, { method, path, token: A, ...c })
  }
}
