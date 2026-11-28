// Store frames with realistic devices. Run from the repo root: node e2e/ui/store-frames/compose2.mjs docs/launch/store-shots-v2 docs/launch/store-frames [outKey]; feature graphic: node e2e/ui/store-frames/feature2.mjs
// Captioned store frames with realistic devices. Usage: node compose2.mjs <shotsDir> <outDir> [onlyKey]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'
import { renderDevice } from './device.mjs'
const require = createRequire(process.cwd() + '/package.json')
const { chromium } = require('playwright-core')
const [shotsDir, outDir, only] = process.argv.slice(2)
const CAP = {
  en: [
    ['today', "Know what's free to spend today", 'Every expense updates your daily number'],
    ['accounts', 'Every account, one clear number', 'Free to spend, set aside and net worth together'],
    ['installments', "Every installment and what's left", 'Tracked at the full price you agreed'],
    ['flow-sms', 'Your bank texts log themselves', null],
    ['goals', 'One goal, saved in several places', 'Bank, dollars and gold count toward one target'],
    ['savings', 'A pocket for everything set aside', "Monthly savings grows from what's left each month"],
    ['income', 'Paydays, regular or not', 'Link each payment to its payday as it lands'],
    ['buddgy-chat', 'Ask Buddgy, answered from your numbers', 'Plain answers about your own month'],
  ],
  ar: [
    ['home-arabic', 'اعرف المتاح لك اليوم', 'كل مصروف يحدّث رقمك اليومي'],
    ['accounts-arabic', 'كل حساباتك في رقم واحد', 'المتاح للإنفاق والمُخصَّص وصافي الثروة معًا'],
    ['installments-arabic', 'كل قسط بموعده وما تبقّى', 'بالسعر الكامل المتفق عليه، بأقساط ثابتة'],
    ['flow-sms-arabic', 'رسائل البنك تسجّل مصروفاتك', null],
    ['goals-arabic', 'هدف واحد في أكثر من مكان', 'البنك والدولار والذهب نحو هدف واحد'],
    ['savings-arabic', 'جيب لكل ما تخصّصه', 'مدخراتك الشهرية تكبر مما يتبقّى كل شهر'],
    ['income-arabic', 'دخلك، منتظم أو غير منتظم', 'اربط كل دفعة بموعدها فور وصولها'],
    ['buddgy-chat', 'اسأل بادجي، والإجابة من أرقامك', 'إجابات واضحة عن شهرك أنت'],
  ],
}
const SMS_SUB = { ios: { en: 'Optional, through a Shortcut you set up', ar: 'اختياري، عبر اختصار تُعدّه بنفسك' }, play: { en: 'Optional. Turn it on in Settings', ar: 'اختياري، فعّله من الإعدادات' } }
const OUTS = {
  'ios-iphone-6.3': { w: 1206, h: 2622, store: 'ios', src: 'ios-phone', kind: 'iphone' },
  'ios-ipad-13': { w: 2064, h: 2752, store: 'ios', src: 'ipad-13', kind: 'ipad' },
  'play-play-phone': { w: 1242, h: 2208, store: 'play', src: 'android-phone', kind: 'galaxy' },
  'play-play-7in': { w: 1200, h: 1920, store: 'play', src: 'play-7in', kind: 'atablet' },
  'play-play-10in': { w: 1600, h: 2560, store: 'play', src: 'play-10in', kind: 'atablet' },
}
const b = await chromium.launch(); let n = 0
for (const [key, o] of Object.entries(OUTS).filter(([k]) => !only || k === only)) {
  const dir = path.join(shotsDir, o.src); if (!fs.existsSync(dir)) continue
  const files = fs.readdirSync(dir)
  const pick = (k) => files.find((x) => x.replace(/^\d+-/, '').replace(/\.png$/, '') === k)
  for (const lang of ['en', 'ar']) {
    let i = 0
    for (const [k, head, sub0] of CAP[lang]) {
      const f = pick(k) ?? pick({ 'home-arabic': 'today', 'accounts-arabic': 'accounts' }[k] ?? k.replace(/-arabic$/, ''))
      if (!f) continue
      i++
      const sub = sub0 ?? SMS_SUB[o.store][lang]
      const img = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64')
      const u = o.w / 100, wide = o.w > o.h * 0.6
      const dev = renderDevice(o.kind, img, 1000, 'var(--sb)', 'var(--sf)')
      const html = `<html><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Geist:wght@500;800&family=IBM+Plex+Sans+Arabic:wght@500;700&display=swap');
      *{margin:0;box-sizing:border-box}html,body{width:${o.w}px;height:${o.h}px;overflow:hidden}
      body{background:radial-gradient(120% 70% at 50% 0%,#13a08f 0%,#0B7568 45%,#06463f 100%);color:#fff;font-family:${lang === 'ar' ? "'IBM Plex Sans Arabic'" : "'Geist'"},sans-serif;display:flex;flex-direction:column;align-items:center}
      .cap{padding:${6.5 * u}px ${7 * u}px 0;text-align:center;direction:${lang === 'ar' ? 'rtl' : 'ltr'}}
      h1{font-size:${(wide ? 5.2 : 7.2) * u}px;line-height:1.12;font-weight:${lang === 'ar' ? 700 : 800};letter-spacing:${lang === 'ar' ? 0 : -0.02}em;text-wrap:balance}
      p{margin-top:${2 * u}px;font-size:${(wide ? 2.6 : 3.5) * u}px;line-height:1.35;font-weight:500;opacity:.86;text-wrap:balance}
      .box{flex:1;width:100%;position:relative;margin:${4.5 * u}px 0 ${5 * u}px}.box>div{position:absolute;left:50%;top:0;transform-origin:top center}</style></head>
      <body><div class="cap"><h1>${head}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="box"><div id="d">${dev}</div></div>
      <script>
        const im = new Image(); im.src = document.querySelector('#d img').src; im.onload = () => {
          const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.drawImage(im, 0, 0, im.width, 4, 0, 0, 4, 4)
          const [r, g, bb] = x.getImageData(1, 1, 1, 1).data; document.body.style.setProperty('--sb', 'rgb(' + r + ',' + g + ',' + bb + ')')
          document.body.style.setProperty('--sf', (r * .299 + g * .587 + bb * .114) > 150 ? '#111' : '#fff'); window.sampled = true }
        const box = document.querySelector('.box'), d = document.getElementById('d'), dev = d.firstElementChild
        const k = Math.min(box.clientHeight / dev.offsetHeight, box.clientWidth * ${wide ? 0.9 : 0.8} / dev.offsetWidth)
        d.style.transform = 'translateX(-50%) scale(' + k + ')'; d.style.width = dev.offsetWidth + 'px'
      </script></body></html>`
      const p = await b.newPage({ viewport: { width: o.w, height: o.h } })
      await p.setContent(html, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.sampled === true); await p.evaluate(() => document.fonts.ready)
      const out = path.join(outDir, key, lang, `${String(i).padStart(2, '0')}-${k}.png`)
      fs.mkdirSync(path.dirname(out), { recursive: true }); await p.screenshot({ path: out }); await p.close(); n++
    }
  }
}
await b.close(); console.log(n, 'frames')
