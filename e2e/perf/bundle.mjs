// Bundle report. Part 1: client chunks on disk (raw + gzip). Part 2: JS actually downloaded per route on a cold, unthrottled load.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = resolve(root, 'e2e/perf/out'); mkdirSync(out, { recursive: true })
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(resolve(d, e.name)) : [resolve(d, e.name)]))
const files = walk(resolve(root, '.next/static')).filter((f) => /\.(js|css)$/.test(f))
const chunks = files.map((f) => { const b = readFileSync(f); return { file: f.split('.next/static/')[1], raw: b.length, gzip: gzipSync(b).length } }).sort((a, b) => b.gzip - a.gzip)
const total = { jsFiles: chunks.filter((c) => c.file.endsWith('.js')).length, jsRaw: 0, jsGzip: 0, cssRaw: 0, cssGzip: 0 }
for (const c of chunks) { if (c.file.endsWith('.js')) { total.jsRaw += c.raw; total.jsGzip += c.gzip } else { total.cssRaw += c.raw; total.cssGzip += c.gzip } }
// library fingerprints in the largest chunks
const libs = ['recharts', 'framer-motion', 'motion-dom', 'date-fns', 'lucide', '@supabase', 'sentry', 'firebase', 'd3-', 'react-dom', 'zustand', 'groq', 'base-ui']
const top = chunks.filter((c) => c.file.endsWith('.js')).slice(0, 15).map((c) => { const s = readFileSync(resolve(root, '.next/static', c.file), 'utf8'); return { ...c, hints: libs.filter((l) => s.includes(l)) } })
const routes = ['/', '/en', '/en/pricing', '/ar', '/flow', '/legal/terms', '/offline', '/install', '/reset-password', '/admin']
const b = await chromium.launch()
const perRoute = []
for (const r of routes) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage()
  const js = new Map(), css = new Map()
  p.on('response', async (res) => { const u = new URL(res.url()); if (u.origin !== 'http://localhost:3100') return
    try { if (u.pathname.endsWith('.js')) { const body = await res.body(); js.set(u.pathname, { raw: body.length, gzip: gzipSync(body).length }) } else if (u.pathname.endsWith('.css')) { const body = await res.body(); css.set(u.pathname, { raw: body.length, gzip: gzipSync(body).length }) } } catch {} })
  await p.goto('http://localhost:3100' + r, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await p.waitForTimeout(1500)
  const sum = (m, k) => [...m.values()].reduce((a, x) => a + x[k], 0)
  perRoute.push({ route: r, finalUrl: p.url().replace('http://localhost:3100', ''), jsChunks: js.size, jsRawKB: +(sum(js, 'raw') / 1024).toFixed(0), jsGzipKB: +(sum(js, 'gzip') / 1024).toFixed(0), cssGzipKB: +(sum(css, 'gzip') / 1024).toFixed(0) })
  await ctx.close()
}
await b.close()
writeFileSync(resolve(out, 'bundle.json'), JSON.stringify({ total, top, perRoute }, null, 1))
console.log(JSON.stringify({ total, perRoute }, null, 1)); console.log(top.map((t) => `${(t.gzip / 1024).toFixed(0)}KB gz ${(t.raw / 1024).toFixed(0)}KB ${t.file} ${t.hints.join(',')}`).join('\n'))
