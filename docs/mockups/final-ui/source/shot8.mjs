// Usage: node shot8.mjs <html> <outdir> <page> [sheetKey|click:selector ...]
// Screenshots both phones after opening the page and running each step (v8_<key> sheet or a click on the final phone).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const req = createRequire('/Users/mohamedmousa/Desktop/Budget Manager/buddget/package.json')
const { chromium } = req('playwright-core')
const [html, out, pg, ...steps] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1180, height: 1300 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await page.goto('file://' + html, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const P = page.locator('[data-screen="proposed"]'), C = page.locator('[data-screen="current"]')
const both = async (name) => { const sy = await page.evaluate(() => window.scrollY); const a = await C.boundingBox(); const b = await P.boundingBox(); await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, clip: { x: a.x, y: a.y + sy, width: b.x + b.width - a.x, height: b.height } }) }
await page.click(`#pz-page [data-page="${pg}"]`); await page.waitForTimeout(500)
await both(`${pg}-0`)
let i = 1
for (const s of steps) {
  if (s.startsWith('click:')) await P.locator(s.slice(6)).first().click()
  else if (s.startsWith('scroll:')) await P.locator('.pz-scroll').evaluate((e, y) => { e.scrollTop = +y }, s.slice(7))
  else await page.click(`#pz-sheets [data-sheet="v8_${s}"]`)
  await page.waitForTimeout(700)
  await both(`${pg}-${i++}`)
}
console.log(errs.length ? errs.join('\n') : 'no errors')
await browser.close()
