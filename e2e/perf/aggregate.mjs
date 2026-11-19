// Median-of-3 tables from out/journey-*.json, out/commits-*.json, out/lighthouse.json. Prints markdown.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = resolve(dirname(fileURLToPath(import.meta.url)), 'out')
const J = (f) => JSON.parse(readFileSync(resolve(out, f), 'utf8'))
const med = (xs) => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : NaN }
const runs = (w) => [1, 2, 3].map((i) => J(`journey-${w}-${i}.json`))
const keys = Object.keys(runs('small')[0].metrics)
console.log('| metric | small runs | small median | large runs | large median |\n|---|---|---|---|---|')
for (const k of keys) { const s = runs('small').map((r) => r.metrics[k]), l = runs('large').map((r) => r.metrics[k]); console.log(`| ${k} | ${s.join(' / ')} | **${med(s)}** | ${l.join(' / ')} | **${med(l)}** |`) }
console.log('\n### requests per step (median, data = REST/RPC/auth/api; sentry envelopes counted apart)\n| step | user | data requests | of which Sentry envelope | static requests | duplicate data requests |\n|---|---|---|---|---|---|')
for (const w of ['small', 'large']) for (const step of Object.keys(runs(w)[0].net)) {
  const rr = runs(w); const get = (r, f) => f(r.net[step] ?? { dataRequests: 0, staticRequests: 0, endpoints: {}, duplicates: [] })
  const sen = (n) => Object.entries(n.endpoints).filter(([k]) => k.includes('/envelope')).reduce((a, [, v]) => a + v, 0)
  console.log(`| ${step} | ${w} | ${med(rr.map((r) => get(r, (n) => n.dataRequests - sen(n))))} | ${med(rr.map((r) => get(r, sen)))} | ${med(rr.map((r) => get(r, (n) => n.staticRequests)))} | ${med(rr.map((r) => get(r, (n) => n.duplicates.length)))} |`)
}
