#!/usr/bin/env node
// Usage: node scripts/csp-check.mjs [baseUrl=http://localhost:3055]
// Asserts every app route is served with a nonce CSP (no unsafe-inline/eval in script-src)
// and that every inline <script> in the HTML carries that same nonce.
const base = (process.argv[2] ?? 'http://localhost:3055').replace(/\/$/, '')
const routes = ['/', '/flow', '/wealth', '/debts', '/reports', '/goals', '/settings', '/offline', '/legal/privacy', '/legal/terms', '/privacy', '/terms']
let failed = 0
const fail = (route, msg) => { failed++; console.error(`FAIL ${route}: ${msg}`) }

for (const route of routes) {
  const res = await fetch(base + route, { redirect: 'manual', headers: { 'user-agent': 'csp-check', cookie: 'sb-x-auth-token=1' } })
  const html = res.status === 200 ? await res.text() : ''
  const csp = res.headers.get('content-security-policy') ?? ''
  if (res.status >= 300 && res.status < 400) { console.log(`skip ${route} -> ${res.status} ${res.headers.get('location')}`); continue }
  const script = csp.split('; ').find((d) => d.startsWith('script-src')) ?? ''
  const nonce = script.match(/'nonce-([^']+)'/)?.[1]
  if (!csp) { fail(route, 'no Content-Security-Policy header'); continue }
  if (!nonce) { fail(route, `script-src has no nonce: ${script}`); continue }
  if (/unsafe-inline|unsafe-eval/.test(script)) fail(route, `script-src weakened: ${script}`)
  const inline = [...html.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1]))
  const bad = inline.filter((m) => !m[1].includes(`nonce="${nonce}"`))
  if (inline.length === 0) fail(route, 'no inline scripts found (HTML not rendered per request?)')
  if (bad.length) fail(route, `${bad.length}/${inline.length} inline scripts lack the nonce`)
  console.log(`${bad.length || !nonce ? 'BAD' : 'ok  '} ${route} status=${res.status} inline=${inline.length}`)
}
process.exit(failed ? 1 : 0)
