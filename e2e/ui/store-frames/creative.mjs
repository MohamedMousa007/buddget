// App Store creative assets (Asset Library): product page header 21:9 3840x1646 and search results 3:2 3840x2560.
// Key content stays inside Apple's art safe area; no logo or wordmark (Apple rule), one short phrase. Run from repo root.
import fs from 'node:fs'; import { createRequire } from 'node:module'
import { renderDevice } from './device.mjs'
const require = createRequire(process.cwd() + '/package.json')
const { chromium } = require('playwright-core')
const R = process.cwd() + '/docs/launch'
const SRC = `${R}/store-shots-v2/ios-phone`
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(`${SRC}/${f}`).toString('base64')
const V = {
  en: { dir: 'ltr', font: "'Geist'", h: "Know what's free to spend today", shots: ['01-today.png', '03-flow-sms.png', '08-accounts.png'] },
  ar: { dir: 'rtl', font: "'IBM Plex Sans Arabic'", h: 'اعرف المتاح لك تصرفه اليوم', shots: ['05-home-arabic.png', '14-flow-sms-arabic.png', '12-accounts-arabic.png'] },
}
// CSS px at deviceScaleFactor 2; safe = Apple's art safe area halved.
const F = {
  header: { w: 1920, h: 823, safe: { x: 548, y: 246, w: 823, h: 330 }, phone: 220, size: 40 },
  search: { w: 1920, h: 1280, safe: { x: 418, y: 382, w: 1084, h: 515 }, phone: 280, size: 54 },
}
const b = await chromium.launch()
fs.mkdirSync(`${R}/store-frames/ios-creative`, { recursive: true })
for (const [fk, f] of Object.entries(F)) for (const [k, v] of Object.entries(V)) {
  const rtl = v.dir === 'rtl', s = f.safe
  const phones = v.shots.map((x, i) => renderDevice('iphone', img(x), i === 0 ? f.phone : f.phone * 0.86, '#f7f8f8', '#111'))
  const textW = s.w * 0.40
  const half = f.phone * 0.98 // half the cluster width: centre phone plus side phones offset 0.55 phone
  const cx = rtl ? s.x + half : s.x + s.w - half // cluster anchored to the safe area's outer edge
  const html = `<html dir="${v.dir}"><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Geist:wght@700;800&family=IBM+Plex+Sans+Arabic:wght@700&display=swap');
  *{margin:0;box-sizing:border-box}body{width:${f.w}px;height:${f.h}px;overflow:hidden;position:relative;color:#fff;font-family:${v.font},sans-serif;
  background:radial-gradient(60% 90% at ${rtl ? 35 : 65}% 45%,#17b19e 0%,#0B7568 42%,#05403a 100%)}
  .glow{position:absolute;inset:0;background:radial-gradient(40% 40% at ${rtl ? 35 : 65}% 50%,rgba(255,255,255,.16),transparent 70%)}
  h1{position:absolute;top:${s.y}px;height:${s.h}px;${rtl ? 'right' : 'left'}:${s.x}px;width:${textW}px;display:flex;align-items:center;font-size:${f.size}px;line-height:1.08;font-weight:800;letter-spacing:${rtl ? 0 : '-.02em'};text-wrap:balance}
  .p{position:absolute;filter:drop-shadow(0 30px 50px rgba(0,0,0,.35))}</style></head><body><div class="glow"></div><h1>${v.h}</h1>
  <div class="p" style="left:${cx - f.phone * 0.43 - f.phone * 0.55}px;top:${s.y + s.h * 0.10}px;transform:rotate(-6deg);opacity:.92">${phones[rtl ? 2 : 1]}</div>
  <div class="p" style="left:${cx - f.phone * 0.43 + f.phone * 0.55}px;top:${s.y + s.h * 0.10}px;transform:rotate(6deg);opacity:.92">${phones[rtl ? 1 : 2]}</div>
  <div class="p" style="left:${cx - f.phone / 2}px;top:${s.y - s.h * 0.04}px;z-index:2">${phones[0]}</div></body></html>`
  const p = await b.newPage({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: 2 })
  await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: `${R}/store-frames/ios-creative/${fk}-${k}.png`, omitBackground: false }); await p.close()
}
await b.close(); console.log('ok')
