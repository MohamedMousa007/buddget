// Store screenshots (STORE_SETUP.md "Screenshot shot list"): one synthetic user (qa-e2e-shots-*) with the Layla Hassan persona,
// seeded through the service-role REST like the journeys, signed in for real, then the 7-shot story captured per device class.
// Plain screenshots, light theme, no captions. The user is deleted at the end and the qa-e2e-* count is printed (count only).
// Run (dev server: TZ=Africa/Cairo NEXT_PUBLIC_DEV_AUTH_BYPASS=0 NEXT_PUBLIC_API_BASE_URL= npx next dev -p 3100 --webpack):
//   TZ=Africa/Cairo node e2e/ui/store-shots.mjs      env: DEVICES=iphone-6.9,ipad-13,... SHOTS=1,3  OUT=docs/launch/store-shots  KEEP_USER=1
import fs from 'node:fs'
import crypto from 'node:crypto'
import { chromium } from '@playwright/test'

const env = { ...process.env }
for (const f of ['.env.local', process.env.QA_ENV_FILE].filter(Boolean)) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l); if (m && !env[m[1]]) env[m[1]] = m[2] }
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY, BASE = 'http://localhost:3100'
if (!URL_ || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
const OUT = env.OUT || 'docs/launch/store-shots'
const PW = 'Qa-Shots-' + crypto.randomBytes(6).toString('hex') + '!x'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
async function rest(path, init = {}) {
  const r = await fetch(`${URL_}${path}`, { ...init, headers: { ...H, Prefer: 'return=representation', ...(init.headers ?? {}) } })
  const t = await r.text(); let j = t; try { j = JSON.parse(t) } catch {}
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} -> ${r.status} ${t.slice(0, 300)}`)
  return j
}
const ins = (table, body, q = '') => rest(`/rest/v1/${table}${q}`, { method: 'POST', body: JSON.stringify(body) })
const upsert = (table, body, key = 'user_id') => rest(`/rest/v1/${table}?on_conflict=${key}`, { method: 'POST', body: JSON.stringify(body), headers: { Prefer: 'resolution=merge-duplicates,return=representation' } })
const patch = (table, q, body) => rest(`/rest/v1/${table}?${q}`, { method: 'PATCH', body: JSON.stringify(body) })

// ---- dates (Cairo) ----
const cairoDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d)
const TODAY = cairoDay()
const [Y, M, D] = TODAY.split('-').map(Number)
const day = (n) => `${Y}-${String(M).padStart(2, '0')}-${String(n).padStart(2, '0')}`
const at = (n, hh, mm = 0) => new Date(Date.UTC(Y, M - 1, n, hh - 2, mm)).toISOString() // Cairo is UTC+2 in November
const monthsAgo = (k, dd) => { const t = new Date(Date.UTC(Y, M - 1 - k, dd)); return t.toISOString().slice(0, 10) }

// ---- persona: Layla Hassan, Cairo, EGP ----
// Invented merchants; the day numbers are clamped to today so the month never shows a future expense.
const EXPENSES = [
  [1, 9, 'Rent', 8500, 'November rent', 'bank', false],
  [2, 18, 'Groceries', 1240, 'Nour Grocers', 'card', true],
  [3, 8, 'Food', 85, 'Fayrouz Café', 'wallet', false],
  [3, 20, 'Utilities', 610, 'Nile Power bill', 'bank', true],
  [4, 13, 'Transport', 142, 'CairoRide trip', 'card', true],
  [5, 14, 'Food', 265, 'El Bostan Koshary', 'cash', false],
  [6, 19, 'Health', 380, 'Sama Pharmacy', 'card', true],
  [7, 11, 'Groceries', 455, 'Dokki Fresh Market', 'cash', false],
  [8, 21, 'Enjoyment', 320, 'Cinema Zamalek', 'card', true],
  [9, 9, 'Fuel', 750, 'Delta Fuel Station', 'card', true],
  [10, 17, 'Utilities', 300, 'Wasla mobile recharge', 'wallet', false],
  [11, 13, 'Food', 190, 'Sakura Bakery', 'cash', false],
  [12, 19, 'Shopping', 1150, 'Bazar Line', 'card', true],
  [13, 8, 'Transport', 96, 'CairoRide trip', 'card', true],
  [14, 20, 'Groceries', 980, 'Nour Grocers', 'card', true],
  [15, 13, 'Food', 340, "Rana's Kitchen", 'card', true],
  [16, 18, 'Enjoyment', 250, 'Lotus Gym day pass', 'wallet', false],
  [17, 9, 'Food', 70, 'Fayrouz Café', 'wallet', false],
  [17, 19, 'Health', 160, 'Sama Pharmacy', 'cash', false],
  [18, 14, 'Education', 450, 'Kalima language class', 'bank', true],
  [19, 12, 'Transport', 118, 'CairoRide trip', 'card', true],
  [19, 20, 'Groceries', 620, 'Dokki Fresh Market', 'card', true],
  [20, 13, 'Food', 215, 'El Bostan Koshary', 'cash', false],
  [20, 21, 'Shopping', 480, 'Mazaya Home', 'card', true],
  [21, 9, 'Food', 65, 'Fayrouz Café', 'card', true],
  [21, 13, 'Groceries', 310, 'Nour Grocers', 'card', true],
]

async function seed(uid) {
  await patch('profiles', `id=eq.${uid}`, { display_name: 'Layla Hassan', name: 'Layla Hassan', base_currency: 'EGP', country: 'EG', city: 'Cairo' })
  await upsert('user_settings', { user_id: uid, language: 'en', theme: 'light', sms_tracking_enabled: false, timezone: 'Africa/Cairo', month_start_day: 1 })
  const opening = monthsAgo(1, 28)
  const pm = async (b) => (await ins('payment_methods', { user_id: uid, currency: 'EGP', opening_at: opening + 'T00:00:00Z', ...b }))[0].id
  const bank = await pm({ name: 'CIB', type: 'bank_account', last4: '4821', opening_balance: 30000, is_default: true, color: '#1f6feb' })
  const card = await pm({ name: 'CIB Visa', type: 'debit_card', last4: '7302', parent_id: bank, color: '#0e7490' })
  const wallet = await pm({ name: 'Vodafone Cash', type: 'wallet', opening_balance: 2400, color: '#dc2626' })
  const cash = await pm({ name: 'Cash', type: 'cash', opening_balance: 3200, color: '#16a34a' })
  const pmOf = { bank, card, wallet, cash }

  const salarySrc = (await ins('income_sources', { user_id: uid, name: 'Salary', amount: 32000, currency: 'EGP', source_type: 'salary', is_recurring: true, recurring_frequency: 'monthly', day_of_month: 1, effective_start: monthsAgo(6, 1), payment_method_id: bank }))[0].id
  // Salary already received in the earlier months, so no payday reads as late (dated before the accounts' opening anchor).
  for (let k = 5; k >= 1; k--) await ins('income_events', { user_id: uid, name: 'Salary', amount: 32000, currency: 'EGP', received_date: monthsAgo(k, 1), occurrence_date: monthsAgo(k, 1), occurred_at: monthsAgo(k, 1) + 'T08:00:00Z', source_type: 'salary', status: 'confirmed', payment_method_id: bank, template_id: salarySrc })
  const smsLog = async (o) => (await ins('sms_parse_log', { user_id: uid, source: 'sms', sender: 'CIB', bank_name: 'CIB', currency: 'EGP', parsed_ok: true, awaiting_confirmation: false, confirmed_at: o.received_at, parse_method: 'curated_db', status: 'confirmed', payment_method_id: o.payment_method_id, ...o }))[0].id
  const income = [
    { name: 'Salary', amount: 32000, n: 1, hh: 10, source_type: 'salary' },
    { name: 'Instapay from Studio Nile', amount: 3500, n: Math.min(D, 19), hh: 16, source_type: 'freelance', noAccount: true },
  ]
  for (const i of income) {
    const log = await smsLog({ amount: i.amount, kind: i.source_type === 'salary' ? 'salary' : 'instant_transfer_in', merchant: i.name, received_at: at(i.n, i.hh), payment_method_id: i.noAccount ? null : bank, account_last4: i.noAccount ? null : '4821' })
    const ev = (await ins('income_events', { user_id: uid, name: i.name, amount: i.amount, currency: 'EGP', received_date: day(i.n), occurrence_date: day(i.n), occurred_at: at(i.n, i.hh), source_type: i.source_type, status: 'confirmed', payment_method_id: i.noAccount ? null : bank, sms_log_id: log, template_id: i.source_type === 'salary' ? salarySrc : null }))[0].id
    await patch('sms_parse_log', `id=eq.${log}`, { income_id: ev })
  }
  let sms = 0
  for (const [n0, hh, category, amount, description, via, fromSms] of EXPENSES) {
    const n = Math.min(n0, D)
    const pmId = pmOf[via]
    const log = fromSms ? await smsLog({ amount, kind: 'purchase', merchant: description, received_at: at(n, hh, 12), payment_method_id: pmId, account_last4: via === 'card' ? '7302' : '4821' }) : null
    const ex = (await ins('expenses', { user_id: uid, amount, currency: 'EGP', category, description, expense_date: day(n), occurred_at: at(n, hh, 12), payment_method_id: pmId, sms_log_id: log }))[0].id
    if (log) { sms++; await patch('sms_parse_log', `id=eq.${log}`, { expense_id: ex }) }
  }

  // Budget: one ready plan, everyday blocks, made active on the profile.
  const plan = (await ins('budget_plans', { user_id: uid, name: 'November plan', status: 'ready', intent: 'balanced', origin: 'manual', income_override: 32000 }))[0].id
  // Row names are the expense category keys: the app matches spending to a budget row by name (the UI shows the localized label).
  const cats = [
    ['Rent', 'bills', 8500, ['Rent'], true], ['Utilities', 'bills', 1200, ['Utilities'], true], ['Groceries', 'everyday', 4000, ['Groceries'], true],
    ['Food', 'everyday', 2000, ['Food'], false], ['Transport', 'everyday', 1000, ['Transport'], true], ['Fuel', 'everyday', 1000, ['Fuel'], true],
    ['Health', 'everyday', 800, ['Health'], true], ['Shopping', 'everyday', 2000, ['Shopping'], false], ['Enjoyment', 'everyday', 1000, ['Enjoyment'], false],
    ['Education', 'everyday', 600, ['Education'], false], ['Debt', 'debts', 1250, ['Debt'], true], ['Savings', 'safety', 3000, ['Savings'], true],
  ]
  let s = 0
  for (const [name, block, amount, ec, essential] of cats) await ins('budget_categories', { user_id: uid, plan_id: plan, name, block, amount, expense_categories: ec, essential, currency: 'EGP', sort_order: s++ })
  await patch('profiles', `id=eq.${uid}`, { active_budget_plan_id: plan })

  // v9 money model: goals and pockets are money set aside inside accounts (parts with a home), never moved out of the bank.
  const goal = async (g) => (await ins('goals', { user_id: uid, category: 'emergency', currency: 'EGP', manual_current_amount: 0, funding_mode: 'manual', status: 'active', ...g }))[0].id
  const part = (b) => ins('savings_accounts', { user_id: uid, category: 'savings', type: 'bank', currency: 'EGP', opening_balance: b.current_balance, ...b })
  const efund = await goal({ name: 'Emergency fund', emoji: '🛟', target_amount: 60000, monthly_contribution: 3000, target_date: `${Y + 1}-09-30`, priority: 1 })
  await part({ name: 'Emergency fund', icon: '🛟', goal_id: efund, held_in_payment_method_id: bank, current_balance: 12000 })
  await part({ name: 'Emergency fund', icon: '🛟', goal_id: efund, held_in_payment_method_id: wallet, current_balance: 500 })
  const laptop = await goal({ name: 'New laptop', emoji: '💻', category: 'quality_of_life', target_amount: 45000, monthly_contribution: 2500, target_date: `${Y + 1}-04-30`, priority: 2 })
  await part({ name: 'New laptop', icon: '💻', goal_id: laptop, held_in_payment_method_id: bank, current_balance: 6500 })
  await part({ name: 'Summer trip', icon: '🏖️', held_in_payment_method_id: bank, current_balance: 4000 })

  // BNPL: a phone on 12 interest-free monthly installments, due on the 28th, 5 already paid.
  const start = monthsAgo(5, 28)
  const bnpl = (await ins('debts', { user_id: uid, name: 'Phone on installments', debt_type: 'installment', direction: 'i_owe', currency: 'EGP', amount: 15000, installment_amount: 1250, installment_count: 12, installment_frequency: 'monthly', installment_start_date: start, installment_item_name: 'Phone', installment_provider: 'other', installment_provider_name: 'Sahla Pay', interest_free: true, payment_due_day: 28, due_date: day(28), creditor: 'Sahla Pay', started_at: start, status: 'active' }))[0].id
  for (let k = 5; k >= 1; k--) await ins('debt_payments', { user_id: uid, debt_id: bnpl, amount: 1250, currency: 'EGP', payment_date: monthsAgo(k, 28), payment_method_id: bank })
  await ins('debts', { user_id: uid, name: 'Borrowed from Omar', debt_type: 'personal', direction: 'i_owe', currency: 'EGP', amount: 4000, person: 'Omar', relationship: 'friend', due_date: `${M === 12 ? Y + 1 : Y}-${String(M === 12 ? 1 : M + 1).padStart(2, '0')}-15`, started_at: monthsAgo(1, 10), received_via: 'cash', status: 'active' })

  // Pro trial, day 8 of 30.
  await upsert('user_entitlements', { user_id: uid, plan_key: 'plus_trial', status: 'trialing', source: 'default', trial_ends_at: new Date(Date.now() + 22.5 * 864e5).toISOString(), current_period_end: null, note: 'qa store shots' })
  return { sms, expenses: EXPENSES.length }
}

// ---- devices ----
const DEVICES = {
  // App area only: the composer draws the status bar and device frame. Heights = screen minus status bar.
  'ios-phone': { viewport: { width: 402, height: 820 }, dsf: 3, shots: [1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], touch: true }, // iPhone Pro 6.3": 402x874, 54pt status bar
  'android-phone': { viewport: { width: 360, height: 756 }, dsf: 3, shots: [1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], touch: true }, // Galaxy S 6.2": 360x780, 24dp status bar
  'ipad-13': { viewport: { width: 1032, height: 1352 }, dsf: 2, shots: [1, 3, 4, 5, 6, 8, 9, 10], touch: true }, // 1032x1376, 24pt status bar
  'play-7in': { viewport: { width: 600, height: 936 }, dsf: 2, shots: [1, 3, 4, 8, 9], touch: true },
  'play-10in': { viewport: { width: 800, height: 1256 }, dsf: 2, shots: [1, 3, 4, 8, 9], touch: true },
}
const SHOT = {
  1: { name: 'today', route: '/', loc: 'en' },
  2: { name: 'sms-tracking', route: '/settings/sms', loc: 'en' },
  3: { name: 'flow-sms', route: '/flow', loc: 'en' },
  4: { name: 'installments', route: '/debts', loc: 'en' },
  5: { name: 'home-arabic', route: '/', loc: 'ar' },
  6: { name: 'buddgy-chat', route: '/', loc: 'en', chat: true },
  7: { name: 'pro-trial', route: '/settings/pro', loc: 'en' },
  8: { name: 'accounts', route: '/accounts', loc: 'en' },
  9: { name: 'savings', route: '/savings', loc: 'en' },
  10: { name: 'goals', route: '/goals', loc: 'en' },
  11: { name: 'income', route: '/paydays', loc: 'en' },
  12: { name: 'accounts-arabic', route: '/accounts', loc: 'ar' },
  13: { name: 'installments-arabic', route: '/debts', loc: 'ar', prepAs: 4 },
  14: { name: 'flow-sms-arabic', route: '/flow', loc: 'ar', prepAs: 3 },
  15: { name: 'goals-arabic', route: '/goals', loc: 'ar' },
  16: { name: 'savings-arabic', route: '/savings', loc: 'ar' },
  17: { name: 'income-arabic', route: '/paydays', loc: 'ar' },
}
const pickDevices = (env.DEVICES || Object.keys(DEVICES).join(',')).split(',')
const pickShots = env.SHOTS ? env.SHOTS.split(',').map(Number) : null
const CHAT_Q = 'How much can I still spend on eating out this month?'
const HIDE = 'nextjs-portal,[data-toast-region],#__next-build-watcher,[data-nextjs-toast]{display:none!important} *{caret-color:transparent!important}'

async function countQa() {
  let n = 0
  for (let page = 1; page < 100; page++) {
    const r = await rest(`/auth/v1/admin/users?page=${page}&per_page=200`)
    const users = r.users ?? []
    n += users.filter((u) => String(u.email ?? '').startsWith('qa-e2e-')).length
    if (users.length < 200) break
  }
  return n
}

const email = `qa-e2e-shots-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}@buddget-qa.test`
const u = await rest('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password: PW, email_confirm: true }) })
const uid = u.id
const report = []
const chrome = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
let chatNote = 'not run'
try {
  console.log('seeded', JSON.stringify(await seed(uid)))
  const b = await chromium.launch({ ...(chrome ? { executablePath: chrome } : {}), args: ['--no-sandbox'] })
  for (const dev of pickDevices) {
    const d = DEVICES[dev]; if (!d) throw new Error('unknown device ' + dev)
    const shots = d.shots.filter((n) => !pickShots || pickShots.includes(n))
    if (!shots.length) continue
    const ctx = await b.newContext({ viewport: d.viewport, deviceScaleFactor: d.dsf, hasTouch: d.touch, isMobile: false, reducedMotion: 'reduce', colorScheme: 'light', timezoneId: 'Africa/Cairo', locale: 'en-US', bypassCSP: true })
    await ctx.route(/^https:\/\/(www\.)?buddget\.app\/api\//, async (r) => { try { await r.fulfill({ response: await r.fetch({ url: r.request().url().replace(/^https:\/\/(www\.)?buddget\.app/, BASE) }) }) } catch { await r.abort().catch(() => {}) } })
    await ctx.route(/\/api\/flags(\?|$)/, async (r) => { let flags = {}; try { const res = await r.fetch({ url: r.request().url().replace(/^https:\/\/(www\.)?buddget\.app/, BASE) }); flags = (await res.json()).flags ?? {} } catch {} await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ flags: { ...flags, onboarding_v1: false } }) }) })
    await ctx.addInitScript((css) => { const add = () => { if (!document.getElementById('qa-hide')) { const s = document.createElement('style'); s.id = 'qa-hide'; s.textContent = css; document.head.appendChild(s) } }; document.addEventListener('DOMContentLoaded', add) }, HIDE)
    const p = await ctx.newPage(); p.setDefaultTimeout(45000)
    await ctx.addCookies([{ name: 'bdg-lang', value: 'en', url: BASE }])
    await p.goto(`${BASE}/flow`, { waitUntil: 'domcontentloaded', timeout: 180000 })
    // The dev server sometimes answers one request with a 500 while it recompiles: reload until the sign-in form is there.
    for (let k = 0; k < 4 && !(await p.getByRole('textbox', { name: 'Email' }).isVisible({ timeout: 20000 }).catch(() => false)); k++) { await p.waitForTimeout(5000); await p.goto(`${BASE}/flow`, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => undefined) }
    await p.getByRole('textbox', { name: 'Email' }).fill(email, { timeout: 60000 })
    await p.getByRole('button', { name: 'Continue', exact: true }).click()
    await p.getByRole('textbox', { name: 'Password' }).fill(PW)
    await p.getByRole('button', { name: 'Sign me in' }).click()
    await p.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('buddget-storage') || 'null')?.state?.profile?.id } catch { return false } }, null, { timeout: 90000 })
    await p.waitForTimeout(4000)
    const setLang = async (l) => {
      await p.evaluate((lang) => { const k = 'buddget-storage'; const j = JSON.parse(localStorage.getItem(k) || '{"state":{}}'); j.state = j.state || {}; j.state.settings = { ...(j.state.settings || {}), theme: 'light', language: lang }; localStorage.setItem(k, JSON.stringify(j)); document.cookie = 'bdg-lang=' + lang + '; path=/'
        // Buddgy's orb parked low on the left edge (where a person can drag it), so it covers the least content.
        const u = JSON.parse(localStorage.getItem('buddget-ui-settings') || '{"state":{},"version":0}'); u.state = { ...(u.state || {}), buddgyOrb: { side: 'left', top: innerHeight - 150 } }; localStorage.setItem('buddget-ui-settings', JSON.stringify(u)) }, l)
    }
    // Warm-up load so the persisted UI settings (orb position) are the ones the app hydrates from on every shot.
    await setLang('en'); await p.goto(`${BASE}/flow`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await p.waitForTimeout(3000); await setLang('en')
    for (const n of shots) {
      const s = SHOT[n]
      const file = `${OUT}/${dev}/${String(n).padStart(2, '0')}-${s.name}.png`
      try {
        await setLang(s.loc)
        await p.goto(BASE + s.route, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await p.waitForFunction((l) => document.documentElement.lang?.startsWith(l) && (document.documentElement.dataset.locale ?? l) === l, s.loc, { timeout: 30000 })
        await p.waitForFunction(() => (document.querySelector('main')?.innerText.trim().length ?? 0) > 20 && !document.querySelector('main .animate-pulse'), null, { timeout: 60000 }).catch(() => undefined)
        await p.evaluate(() => document.fonts.ready)
        await p.waitForTimeout(2500)
        if (await dismissNotices(p)) { await p.goto(BASE + s.route, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForFunction(() => (document.querySelector('main')?.innerText.trim().length ?? 0) > 20, null, { timeout: 60000 }).catch(() => undefined); await p.waitForTimeout(2500) }
        if (s.chat) chatNote = await chat(p)
        else await prep(s.prepAs ?? n, p)
        await p.evaluate(() => document.activeElement?.blur?.())
        await p.waitForTimeout(800)
        fs.mkdirSync(`${OUT}/${dev}`, { recursive: true })
        await p.screenshot({ path: file, animations: 'disabled' })
        report.push({ dev, n, file, url: new URL(p.url()).pathname, lang: await p.evaluate(() => document.documentElement.lang) })
      } catch (e) { report.push({ dev, n, file, error: String(e).slice(0, 200) }) }
    }
    await setLang('en')
    await ctx.close()
  }
  await b.close()
} finally {
  if (!env.KEEP_USER) {
    for (const t of ['trial_claims', 'billing_events']) await fetch(`${URL_}/rest/v1/${t}?user_id=eq.${uid}`, { method: 'DELETE', headers: H }).catch(() => {})
    for (const w of [0, 1500, 4000]) { await new Promise((r) => setTimeout(r, w)); const r = await fetch(`${URL_}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: H }); if (r.ok || r.status === 404) break }
    console.log('qa-e2e-* users left:', await countQa())
  } else console.log('KEEP_USER: kept', uid)
}
fs.mkdirSync('e2e/ui/out', { recursive: true })
fs.writeFileSync('e2e/ui/out/store-shots.json', JSON.stringify({ chatNote, report }, null, 1))
console.log('shots', report.filter((r) => !r.error).length, 'errors', report.filter((r) => r.error).length, '| chat:', chatNote)
for (const r of report.filter((x) => x.error)) console.log('ERR', r.dev, r.n, r.error)

// Opens Buddgy, types one question and waits for a real answer. Never fakes one: on no answer it leaves the typed question in the composer.
async function chat(p) {
  const opener = p.getByRole('button', { name: /buddgy/i }).first()
  await opener.click({ timeout: 15000 })
  const box = p.locator('[role=dialog] textarea, [role=dialog] input[type=text]').first()
  await box.waitFor({ timeout: 20000 })
  await box.fill(CHAT_Q)
  if (env.NO_AI) return 'question typed, not sent (NO_AI)'
  await p.locator('[role=dialog]').getByRole('button', { name: /send/i }).click()
  const answered = await p.waitForFunction((q) => {
    const d = document.querySelector('[role=dialog]'); if (!d) return false
    const t = d.innerText; const i = t.indexOf(q); if (i < 0) return false
    const after = t.slice(i + q.length).trim()
    return after.length > 60 && !d.querySelector('[aria-busy=true], .animate-pulse')
  }, CHAT_Q, { timeout: 90000 }).then(() => true, () => false)
  if (!answered) {
    await p.waitForTimeout(500)
    return 'no answer within 90 s'
  }
  // Let the reply finish streaming and the composer's quota wheel settle.
  await p.waitForFunction(() => !document.querySelector('[role=dialog] .animate-spin, [role=dialog] [aria-busy=true]'), null, { timeout: 20000 }).catch(() => undefined)
  await p.waitForTimeout(3000)
  return 'answered live'
}

// Trial and feature prompts (PromptBanner) cover the hero; close them the way a person would (their snooze/close button).
async function dismissNotices(p) {
  let any = false
  for (const text of ['Try the Advisor', 'جرّب المساعد']) {
    const closed = await p.evaluate((t) => {
      const hit = [...document.querySelectorAll('body *')].find((e) => e.childElementCount === 0 && e.textContent?.trim() === t && e.getBoundingClientRect().height > 0)
      for (let el = hit; el; el = el.parentElement) { const btn = el.querySelector('button[aria-label]'); if (btn) { btn.click(); return true } }
      return false
    }, text)
    if (closed) { any = true; await p.waitForTimeout(800) }
  }
  return any // the snooze shows a short "back at" toast in the header: the caller reloads the screen
}
// Scrolls the element so its top sits at `frac` of the viewport height (works whether the window or <main> scrolls).
async function scrollToFrac(p, loc, frac) {
  const h = await loc.elementHandle({ timeout: 20000 })
  await h.evaluate((el, f) => {
    el.scrollIntoView({ block: 'start', behavior: 'instant' })
    let sc = el.parentElement
    while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement
    sc = sc || document.scrollingElement
    sc.style.scrollBehavior = 'auto'
    sc.scrollBy(0, el.getBoundingClientRect().top - innerHeight * f)
  }, frac)
  await p.waitForTimeout(700)
}
function prep(n, p) {
  const PREP = {
  2: (p) => scrollToFrac(p, p.locator('main').getByText('SMS tracking', { exact: true }).first(), 0.28),
  3: (p) => scrollToFrac(p, p.locator('main').getByText('Instapay from Studio Nile', { exact: true }).first(), 0.45),
  4: async (p) => {
    const notNow = p.locator('main').getByRole('button', { name: /^(Not now|ليس الآن)$/ })
    for (let k = 0; k < 4 && (await notNow.isVisible().catch(() => false)); k++) { await notNow.click(); await p.waitForTimeout(900) } // one "track as a goal?" card per debt
    // v9 Debts: Borrow / Installments / Cards segmented control (radio or plain button, label alone).
    await p.locator('main').getByText(/^(Installments|أقساط|تقسيط)$/).first().click({ timeout: 8000 }).catch(() => undefined)
    await p.waitForTimeout(1200)
  },
  }
  return PREP[n]?.(p)
}
