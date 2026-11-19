// Exploration driver: node drive.ts <path> <actions.js>; actions run as `async (p) => {...}`; dumps aria snapshot.
import { chromium } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { forceFlags, installApiShim } from './apiShim'
const [,, path, actFile] = process.argv
const STATE = process.env.STATE!, OUT = process.env.XOUT!
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, baseURL: 'http://localhost:3100', bypassCSP: true, storageState: existsSync(STATE) ? STATE : undefined })
  await installApiShim(ctx); await forceFlags(ctx, { onboarding_v1: true })
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error' && !/Download the React|Sentry/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 160)) })
  p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('_next')) console.log('HTTP', r.status(), r.request().method(), r.url().slice(0, 140)) })
  await p.goto(path, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(3500)
  try {
    if (actFile) { const fn = eval(`(async (p) => { ${readFileSync(actFile, 'utf8')} })`); await fn(p) }
  } catch (e) { console.log('ACTION ERROR', String(e).slice(0, 600)) }
  await p.waitForTimeout(1500)
  const snap = await p.locator('body').ariaSnapshot()
  writeFileSync(`${OUT}/last.yml`, snap); await p.screenshot({ path: `${OUT}/last.png` })
  console.log('URL', p.url()); console.log(snap.replace(/\n\s*- \/url: .*/g, '').slice(0, +(process.env.N ?? 5000)))
  await ctx.storageState({ path: STATE }); await b.close()
})()
