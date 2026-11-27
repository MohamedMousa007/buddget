// QA Session 06: warm latency of read endpoints (3 runs each, qa-api-1). Usage: QA_PW_FILE=<path> node e2e/api/latency.mjs
import { call, signIn } from './lib.mjs'
const A = (await signIn('A')).access_token
for (const path of ['/api/buddgy/usage', '/api/entitlements/me', '/api/notifications', '/api/devices', '/api/flags', '/api/rates', '/api/gold', '/api/health', '/api/support/tickets']) {
  const ms = []
  for (let i = 0; i < 3; i++) ms.push((await call(`${path} #${i + 1}`, { path, token: A })).ms)
  console.log(`== ${path} median ${ms.sort((a, b) => a - b)[1]}ms`)
}
