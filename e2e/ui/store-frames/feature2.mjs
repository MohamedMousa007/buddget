import fs from 'node:fs'; import { createRequire } from 'node:module'
import { renderDevice } from './device.mjs'
const require = createRequire(process.cwd() + '/package.json')
const { chromium } = require('playwright-core')
const R = process.cwd() + '/docs/launch'
const SRC = process.argv[2] || `${R}/store-shots-v2/android-phone`
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(`${SRC}/${f}`).toString('base64')
const V = {
  en: { dir: 'ltr', font: "'Geist'", h: "Know what's free to spend today", p: 'Bank texts log your spending. Installments, debts and gold in one plan.', a: '01-today.png', b: '08-accounts.png' },
  ar: { dir: 'rtl', font: "'IBM Plex Sans Arabic'", h: 'اعرف المتاح لك اليوم', p: 'رسائل البنك تسجّل مصروفاتك، وأقساطك وديونك وذهبك في خطة واحدة.', a: '05-home-arabic.png', b: '12-accounts-arabic.png' },
}
const b = await chromium.launch()
for (const [k, v] of Object.entries(V)) {
  const back = renderDevice('galaxy', img(v.b), 196, 'var(--sb)', '#111'), front = renderDevice('galaxy', img(v.a), 210, 'var(--sb)', '#111')
  const html = `<html dir="${v.dir}"><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Geist:wght@500;800&family=IBM+Plex+Sans+Arabic:wght@500;700&display=swap');
  *{margin:0;box-sizing:border-box}body{--sb:#f7f8f8;width:1024px;height:500px;overflow:hidden;background:radial-gradient(120% 120% at 0% 0%,#13a08f 0%,#0B7568 45%,#06463f 100%);color:#fff;font-family:${v.font},sans-serif;display:flex;align-items:center;padding:0 60px;gap:24px}
  .t{flex:1}.w{font-family:'Geist';font-weight:800;font-size:38px;letter-spacing:-.02em;opacity:.92}h1{margin-top:16px;font-size:46px;line-height:1.08;font-weight:800;text-wrap:balance}p{margin-top:16px;font-size:21px;line-height:1.35;opacity:.86;font-weight:500;max-width:430px;text-wrap:balance}
  .ph{position:relative;width:400px;height:500px}.ph>div{position:absolute}.a{top:26px;${v.dir === 'rtl' ? 'right' : 'left'}:20px;z-index:2}.b{top:58px;${v.dir === 'rtl' ? 'left' : 'right'}:10px;z-index:1}</style></head>
  <body><div class="t"><div class="w">buddget</div><h1>${v.h}</h1><p>${v.p}</p></div><div class="ph"><div class="a">${front}</div><div class="b">${back}</div></div></body></html>`
  const p = await b.newPage({ viewport: { width: 1024, height: 500 } })
  await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready)
  fs.mkdirSync(`${R}/store-frames/play-feature`, { recursive: true })
  await p.screenshot({ path: `${R}/store-frames/play-feature/feature-graphic-${k}.png` }); await p.close()
}
await b.close(); console.log('ok')
