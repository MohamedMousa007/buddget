// S8g: Pro, Usage, Rewards, Invite, Founders and the Settings hub (PRO tag, tier badge, Pro and invite cards) in en/ar x light/dark
// x 375/1440, with axe (WCAG violations) and the real 44 px tap hit test from tap.mjs (a 44x44 box around each control's centre must
// hit that control). One synthetic Pro, Diamond, founder user (qa-e2e-pr-sweep-*) is created and deleted here.
// Run: QA_ENV_FILE=<file with QA_PW> node e2e/ui/pro-rewards-sweep.mjs   (dev server on :3100). Output: e2e/ui/out/pro-rewards-sweep.json
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const env = { ...process.env }
for (const f of ['.env.local', process.env.QA_ENV_FILE].filter(Boolean)) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l); if (m && !env[m[1]]) env[m[1]] = m[2] }
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY, PW = env.QA_PW, BASE = 'http://localhost:3100'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const svc = (p, init = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal', ...(init.headers ?? {}) } })
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const chrome = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined

const ROUTES = (process.env.ROUTES || 'settings,settings/pro,settings/pro/usage,settings/rewards,settings/invite,settings/founders').split(',')
const LOCS = (process.env.LOCS || 'en,ar').split(','), THEMES = (process.env.THEMES || 'light,dark').split(','), VPS = (process.env.VPS || '375,1440').split(',').map(Number)

const email = `qa-e2e-pr-sweep-${Date.now().toString(36)}@buddget-qa.test`
const u = await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: PW, email_confirm: true }) })).json()
const uid = u.id
const out = []
try {
  await svc('user_entitlements?on_conflict=user_id', { method: 'POST', body: JSON.stringify({ user_id: uid, plan_key: 'plus', status: 'active', source: 'apple', product_id: 'pro_monthly', store: 'app_store', current_period_end: new Date(Date.now() + 30 * 864e5).toISOString() }) })
  await svc('loyalty_accounts?on_conflict=user_id', { method: 'POST', body: JSON.stringify({ user_id: uid, lifetime_points: 900, points_balance: 900, tier_key: 'diamond', gifted_rank: 2, streak_weeks: 5, multiplier_step: 1 }) })
  const taken = new Set((await (await fetch(`${URL_}/rest/v1/founders?number=gte.90&select=number`, { headers: H })).json()).map((x) => x.number))
  let n = 100; while (taken.has(n)) n--
  await svc('founders', { method: 'POST', body: JSON.stringify({ number: n, user_id: uid, cohort: 'public', qualified_at: new Date().toISOString() }) })
  await svc(`profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ display_name: 'Layla Sweep' }) })

  const b = await chromium.launch(chrome ? { executablePath: chrome } : {})
  for (const vw of VPS) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vw < 800 ? 812 : 900 }, bypassCSP: true, hasTouch: vw < 800 })
    await ctx.route(/^https:\/\/(www\.)?buddget\.app\/api\//, async (r) => { try { await r.fulfill({ response: await r.fetch({ url: r.request().url().replace(/^https:\/\/(www\.)?buddget\.app/, BASE) }) }) } catch { await r.abort() } })
    // Onboarding is a 10% rollout: keep it off so it never takes the screen.
    await ctx.route(/\/api\/flags(\?|$)/, async (r) => { let flags = {}; try { const res = await r.fetch({ url: r.request().url().replace(/^https:\/\/(www\.)?buddget\.app/, BASE) }); flags = (await res.json()).flags ?? {} } catch {} await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ flags: { ...flags, onboarding_v1: false } }) }) })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/flow`, { waitUntil: 'domcontentloaded' })
    if (!(await p.getByRole('textbox', { name: 'Email' }).isVisible({ timeout: 30000 }).catch(() => false))) await p.reload()
    await p.getByRole('textbox', { name: 'Email' }).fill(email, { timeout: 60000 })
    await p.getByRole('button', { name: 'Continue', exact: true }).click()
    await p.getByRole('textbox', { name: 'Password' }).fill(PW)
    await p.getByRole('button', { name: 'Sign me in' }).click()
    // Signed in once the store holds this account's profile (works in any language the account last saved).
    await p.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('buddget-storage') || 'null')?.state?.profile?.id } catch { return false } }, null, { timeout: 90000 }).catch(async (e) => { await p.screenshot({ path: 'e2e/ui/out/prs-signin-fail.png' }); throw e })
    await p.waitForTimeout(3000)
    for (const loc of LOCS) for (const theme of THEMES) {
      await p.evaluate(([l, t]) => { const k = 'buddget-storage'; const j = JSON.parse(localStorage.getItem(k) || '{"state":{}}'); j.state = j.state || {}; j.state.settings = { ...(j.state.settings || {}), theme: t, language: l }; localStorage.setItem(k, JSON.stringify(j)); document.cookie = 'bdg-lang=' + l + '; path=/' }, [loc, theme])
      await p.emulateMedia({ colorScheme: theme })
      for (const r of ROUTES) {
        const tag = `${vw}/${loc}/${theme}/${r}`
        try {
          await p.goto(`${BASE}/${r}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
          await p.waitForFunction(() => (document.querySelector('main')?.innerText.trim().length ?? 0) > 20 && !document.querySelector('main .animate-pulse'), null, { timeout: 60000 }).catch(() => undefined)
          await p.waitForTimeout(2500)
          await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
          const facts = await p.evaluate(() => ({ dir: document.documentElement.dir, dark: document.documentElement.classList.contains('dark'), url: location.pathname, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }))
          await p.addScriptTag({ content: axeSrc })
          const axe = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'], exclude: [['nextjs-portal']] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map((x) => x.target.join(' ').slice(0, 90)) })))
          const tap = await p.evaluate(() => {
            const els = [...document.querySelectorAll('main button,main a[href],main [role=button],main [role=switch],main [role=tab],main input:not([type=hidden])')].filter((e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[aria-hidden=true]') && !e.disabled })
            const bad = []
            for (const e of els) {
              e.scrollIntoView({ block: 'center', inline: 'center' })
              const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue
              const cx = r.x + r.width / 2, cy = r.y + r.height / 2, dx = 21, dy = 21
              let miss = 0; const tgt = new Set()
              for (const [x, y] of [[cx - dx, cy - dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy + dy]]) { const t = document.elementFromPoint(Math.max(1, Math.min(innerWidth - 1, x)), Math.max(1, Math.min(innerHeight - 1, y))); if (!(t && (t === e || e.contains(t)))) { miss++; tgt.add(t ? (t.tagName + '.' + String(t.className || '').split(' ')[0]).slice(0, 40) + (t.closest('button,a,[role=button]') ? '(ctl)' : '') : 'none') } }
              if (miss) bad.push({ t: (e.getAttribute('aria-label') || e.innerText || e.tagName).replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), miss, tgt: [...tgt].join('+') })
            }
            return { n: els.length, bad }
          })
          const flagged = axe.some((v) => v.impact === 'critical' || v.impact === 'serious') || facts.hscroll || facts.url !== '/' + r
          if (flagged && process.env.SHOTS) await p.screenshot({ path: `e2e/ui/out/prs-${tag.replace(/\//g, '_')}.png`, fullPage: true })
          out.push({ tag, ...facts, axe, tap })
        } catch (e) { out.push({ tag, error: String(e).slice(0, 160) }) }
      }
    }
    await ctx.close()
  }
  await b.close()
} finally {
  for (const t of ['founders', 'billing_events', 'trial_claims']) await fetch(`${URL_}/rest/v1/${t}?user_id=eq.${uid}`, { method: 'DELETE', headers: H })
  await fetch(`${URL_}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: H })
}
fs.mkdirSync('e2e/ui/out', { recursive: true })
fs.writeFileSync('e2e/ui/out/pro-rewards-sweep.json', JSON.stringify(out, null, 1))
const agg = {}
for (const x of out) { for (const v of x.axe ?? []) (agg[`axe ${v.impact} ${v.id} ${v.ex[0] ?? ''}`] ??= new Set()).add(x.tag); for (const t of x.tap?.bad ?? []) (agg[`tap ${t.t} ${t.w}x${t.h} miss${t.miss} -> ${t.tgt}`] ??= new Set()).add(x.tag); if (x.hscroll) (agg['horizontal scroll'] ??= new Set()).add(x.tag); if (x.url && !x.tag.endsWith(x.url.slice(1))) (agg[`redirected to ${x.url}`] ??= new Set()).add(x.tag); if (x.error) (agg[`error ${x.error.slice(0, 60)}`] ??= new Set()).add(x.tag) }
console.log('pages', out.length, 'errors', out.filter((x) => x.error).length, 'controls', out.reduce((a, x) => a + (x.tap?.n ?? 0), 0))
for (const [k, v] of Object.entries(agg)) console.log(`${v.size}x`, k.replace(/qa-e2e[^ ]*/g, '<email>'), '|', [...v].slice(0, 4).join(', '))
