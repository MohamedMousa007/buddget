/* eslint-disable @typescript-eslint/no-explicit-any -- perf harness reads untyped in-page globals and PostgREST JSON */
import { type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const OUT = resolve(__dirname, 'out')
mkdirSync(OUT, { recursive: true })
export const BASE = 'http://localhost:3100'

/**
 * Chrome DevTools "Fast 4G" preset (Puppeteer PredefinedNetworkConditions): 9 Mbps down, 1.5 Mbps up, 165 ms RTT,
 * with the same 0.9 bandwidth factor. CPU 4x slowdown.
 */
export const FAST_4G = { offline: false, latency: 60 * 2.75, downloadThroughput: (9 * 1000 * 1000) / 8 * 0.9, uploadThroughput: (1.5 * 1000 * 1000) / 8 * 0.9 }
export const CPU_RATE = 4

export async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', FAST_4G)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE })
  return cdp
}

export interface Users { small: { email: string; id: string }; large: { email: string; id: string } }
export const USERS_FILE = resolve(OUT, 'users.json')
export const readUsers = (): Users => JSON.parse(readFileSync(USERS_FILE, 'utf8'))
export const hasUsers = () => existsSync(USERS_FILE)

export function writeJson(name: string, data: unknown) {
  writeFileSync(resolve(OUT, name), JSON.stringify(data, null, 2))
}

/**
 * In-page instrumentation, installed before any app script:
 * - last pointerdown time (t0 of a Playwright click),
 * - last DOM mutation time (for "settled"),
 * - long tasks, FCP/LCP,
 * - optional React commit counter through a minimal DevTools hook (production React calls it when present).
 */
export async function instrument(ctx: BrowserContext, opts: { commits?: boolean; attribute?: boolean } = {}) {
  await ctx.addInitScript((o) => {
    const w = window as any
    w.__perf = { pointer: 0, mut: 0, longtasks: [] as number[][], fcp: 0, lcp: 0, commits: 0, commitTimes: [] as number[], comp: {} as Record<string, number> }
    const P = w.__perf
    addEventListener('pointerdown', () => { P.pointer = performance.now() }, true)
    const startMO = () => new MutationObserver(() => { P.mut = performance.now() }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true })
    if (document.documentElement) startMO(); else addEventListener('DOMContentLoaded', startMO)
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.longtasks.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true }) } catch { /* unsupported */ }
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') P.fcp = e.startTime }).observe({ type: 'paint', buffered: true }) } catch { /* unsupported */ }
    try { new PerformanceObserver((l) => { const es = l.getEntries(); if (es.length) P.lcp = es[es.length - 1].startTime }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch { /* unsupported */ }
    if (o.commits) {
      let id = 0
      const nameOf = (f: any): string | null => {
        const t = f.type
        if (!t || typeof t === 'string') return null
        return t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || null
      }
      w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        renderers: new Map(), supportsFiber: true, isDisabled: false,
        inject(r: unknown) { id += 1; this.renderers.set(id, r); return id },
        checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, setStrictMode() {},
        onCommitFiberRoot(_id: number, root: any) {
          P.commits += 1
          P.commitTimes.push(performance.now())
          if (!o.attribute) return
          // Fibers that rendered in this commit carry the PerformedWork flag (1).
          const stack = [root.current]
          let n = 0
          while (stack.length && n < 200000) {
            const f = stack.pop(); n++
            if (!f) continue
            if (f.flags & 1) {
              const nm = nameOf(f)
              if (nm) {
                // Production builds minify names; key by name plus a source snippet and the first host element beneath it.
                let h = f.child; let g = 0
                while (h && typeof h.type !== 'string' && g++ < 12) h = h.child
                const t = f.type; const fn = typeof t === 'function' ? t : t?.render ?? t?.type
                const src = typeof fn === 'function' ? Function.prototype.toString.call(fn).replace(/\s+/g, ' ').slice(0, 70) : ''
                const host = h && typeof h.type === 'string' ? `${h.type}.${String(h.memoizedProps?.className ?? '').slice(0, 40)}` : ''
                const key = `${nm} | ${host} | ${src}`
                P.comp[key] = (P.comp[key] ?? 0) + 1
              }
            }
            if (f.sibling) stack.push(f.sibling)
            if (f.child) stack.push(f.child)
          }
        },
      }
    }
  }, opts)
}

/** Waits until no DOM mutation for `quiet` ms; returns the last mutation time (performance.now basis). */
export async function settle(page: Page, quiet = 1000, cap = 20000): Promise<number> {
  return page.evaluate(([q, c]) => new Promise<number>((res) => {
    const P = (window as any).__perf
    const start = performance.now()
    const tick = () => {
      const now = performance.now()
      if (now - P.mut >= q || now - start > c) return res(P.mut)
      setTimeout(tick, 50)
    }
    tick()
  }), [quiet, cap] as const)
}

/** Sum of long-task time inside [a, b]. */
export async function longTaskMs(page: Page, a: number, b: number): Promise<number> {
  return page.evaluate(([x, y]) => {
    let s = 0
    for (const [st, d] of (window as any).__perf.longtasks as number[][]) if (st >= x && st <= y) s += d
    return Math.round(s)
  }, [a, b] as const)
}

/** Network log with a step label. Static Next assets are counted apart from data round trips. */
export interface Req { step: string; method: string; url: string; kind: string; body: string; t: number; status?: number; bytes?: number }
export function netLog(page: Page) {
  const log: Req[] = []
  const state = { step: 'boot', inflight: 0, lastData: Date.now() }
  const kindOf = (u: string) => {
    const url = new URL(u)
    if (url.pathname.startsWith('/_next/')) return 'static'
    if (url.pathname.startsWith('/rest/v1/rpc/')) return 'rpc'
    if (url.pathname.startsWith('/rest/v1/')) return 'rest'
    if (url.pathname.startsWith('/auth/v1/')) return 'auth'
    if (url.pathname.startsWith('/realtime/')) return 'realtime'
    if (url.pathname.startsWith('/storage/')) return 'storage'
    if (url.pathname.startsWith('/api/')) return 'api'
    if (url.origin === BASE) return url.pathname.match(/\.(png|svg|ico|woff2?|webp|jpg|json|js|css|webmanifest)$/) ? 'static' : 'document'
    return 'thirdparty'
  }
  const data = (k: string) => !['static', 'thirdparty', 'document'].includes(k)
  page.on('request', (r) => {
    if (r.url().startsWith('data:')) return
    const kind = kindOf(r.url())
    const e: Req = { step: state.step, method: r.method(), url: r.url(), kind, body: (r.postData() ?? '').slice(0, 300), t: Date.now() }
    log.push(e)
    ;(r as any).__e = e
    if (data(kind)) { state.inflight++; state.lastData = Date.now() }
  })
  const done = async (r: any, failed: boolean) => {
    const e = r.__e as Req | undefined
    if (!e) return
    if (data(e.kind)) { state.inflight = Math.max(0, state.inflight - 1); state.lastData = Date.now() }
    if (!failed) {
      try { const res = await r.response(); e.status = res?.status(); const s = await r.sizes(); e.bytes = s.responseBodySize } catch { /* closed */ }
    } else e.status = -1
  }
  page.on('requestfinished', (r) => void done(r, false))
  page.on('requestfailed', (r) => void done(r, true))
  return {
    log,
    set step(s: string) { state.step = s },
    /** Waits until no data request is in flight and none started for `quiet` ms. */
    async quiet(quiet = 1500, cap = 15000) {
      const start = Date.now()
      while (Date.now() - start < cap) {
        if (state.inflight === 0 && Date.now() - state.lastData >= quiet) return
        await page.waitForTimeout(100)
      }
    },
  }
}

export function summarizeNet(log: Req[]) {
  const by: Record<string, { dataRequests: number; staticRequests: number; staticBytes: number; dataBytes: number; byKind: Record<string, number>; duplicates: { key: string; n: number }[]; endpoints: Record<string, number> }> = {}
  for (const r of log) {
    const s = (by[r.step] ??= { dataRequests: 0, staticRequests: 0, staticBytes: 0, dataBytes: 0, byKind: {}, duplicates: [], endpoints: {} })
    s.byKind[r.kind] = (s.byKind[r.kind] ?? 0) + 1
    if (r.kind === 'static' || r.kind === 'document' || r.kind === 'thirdparty') { s.staticRequests++; s.staticBytes += r.bytes ?? 0; continue }
    if (r.method === 'OPTIONS') continue
    s.dataRequests++
    s.dataBytes += r.bytes ?? 0
    const u = new URL(r.url)
    const ep = `${r.method} ${u.pathname}`
    s.endpoints[ep] = (s.endpoints[ep] ?? 0) + 1
  }
  for (const step of Object.keys(by)) {
    const seen: Record<string, number> = {}
    for (const r of log) {
      if (r.step !== step || ['static', 'document', 'thirdparty'].includes(r.kind) || r.method === 'OPTIONS') continue
      const key = `${r.method} ${r.url.replace(/access_token=[^&]+/, 'access_token=x')} ${r.body}`
      seen[key] = (seen[key] ?? 0) + 1
    }
    by[step].duplicates = Object.entries(seen).filter(([, n]) => n > 1).map(([key, n]) => ({ key: key.slice(0, 260), n }))
  }
  return by
}

export const median = (xs: number[]) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q)
  if (!a.length) return NaN
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2
}
