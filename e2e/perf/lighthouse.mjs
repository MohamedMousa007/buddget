// Lighthouse (mobile, default simulated throttling) x3 per URL. Usage: node lighthouse.mjs <lighthouse-module-dir>
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { launch } from 'chrome-launcher'
const require = createRequire((process.argv[2] ?? process.cwd()) + '/')
const { default: lighthouse } = await import(require.resolve('lighthouse'))
const URLS = { '/': '/', 'en-home': '/en', 'en-pricing': '/en/pricing', 'en-features': '/en/features', 'ar-home': '/ar', 'signin(/flow signed out)': '/flow' }
const out = {}
mkdirSync(new URL('./out/lh', import.meta.url).pathname, { recursive: true })
for (const [name, path] of Object.entries(URLS)) {
  out[name] = []
  for (let i = 0; i < 3; i++) {
    const chrome = await launch({ chromePath: '/opt/pw-browsers/chromium', chromeFlags: ['--headless=new', '--no-sandbox'] })
    const r = await lighthouse('http://localhost:3100' + path, { port: chrome.port, output: 'json', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } })
    const a = r.lhr.audits, c = r.lhr.categories
    out[name].push({ perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100), fcp: a['first-contentful-paint'].numericValue, lcp: a['largest-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue, cls: a['cumulative-layout-shift'].numericValue, si: a['speed-index'].numericValue, tti: a.interactive.numericValue, bytes: a['total-byte-weight'].numericValue, requests: a['network-requests'].details.items.length })
    if (i === 0) writeFileSync(`${new URL('./out/lh', import.meta.url).pathname}/${name.replace(/\W+/g, '_')}.json`, JSON.stringify(r.lhr))
    await chrome.kill()
  }
}
writeFileSync(new URL('./out/lighthouse.json', import.meta.url).pathname, JSON.stringify(out, null, 1))
