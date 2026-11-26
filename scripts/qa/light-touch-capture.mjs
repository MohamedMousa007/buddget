/**
 * Captures the running app next to every approved light-touch mockup screen.
 *
 *   node scripts/qa/light-touch-capture.mjs [name-filter ...]
 *
 * Needs the dev server from .claude/launch.json "buddget-qa-local" (auth bypass, empty Supabase env) on
 * BASE_URL (default http://localhost:3001). Writes:
 *   docs/mockups/light-touch/app-screens/<name>.png   the app at 390x844 @2x
 *   docs/mockups/light-touch/compare/<name>.png       mockup left, app right, same height
 *   docs/mockups/light-touch/compare/checks.json      computed-style checks + skipped screens with reasons
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { launch, phoneContext, seededState, go, tap, settle } from './light-touch-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DIR = path.join(ROOT, 'docs/mockups/light-touch')
const MOCK = path.join(DIR, 'screens')
const APP = path.join(DIR, 'app-screens')
const CMP = path.join(DIR, 'compare')

/**
 * Data variants: each screen picks one; each is seeded once into its own storage state.
 * The billing plan (`__qa.plan`) is not persisted, so it is applied after every load. `everyLoad` re-runs `mutate`
 * after load too: DevAuthBypassSeed re-adds demo income on mount when there is none.
 */
const STATES = {
  full: { seed: true, plan: 'active' },
  // Free (mockup state-insfree): enough history for two Pro findings, so their tiles show locked and the band says
  // "2 more findings are in Pro". Eight weeks of small daily buys with Thursdays heavier (Your big day) and six earlier
  // Shopping buys under one large one this cycle (Unusual buy).
  free: { seed: true, plan: 'free', mutate: () => {
    const s = window.__finance.getState()
    const pm = s.paymentMethods.find((m) => m.type === 'debit_card')?.id ?? s.paymentMethods[0].id
    const pad = (n) => String(n).padStart(2, '0')
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const add = (description, category, amount, d) => s.addExpense({ description, category, amount, currency: 'EGP', paymentMethodId: pm, isRecurring: false, date: iso(d), occurredAt: `${iso(d)}T13:20:00` })
    for (let back = 1; back <= 60; back++) {
      const d = new Date()
      d.setDate(d.getDate() - back)
      add('Koshary', 'Food', 80, d)
      if (d.getDay() === 4) add('Dinner out', 'Food', 420, d)
    }
    const cycleStart = new Date()
    cycleStart.setDate(1)
    for (let k = 0; k < 6; k++) {
      const d = new Date(cycleStart)
      d.setDate(d.getDate() - 5 - k * 7)
      add('H&M', 'Shopping', 900 + k * 50, d)
    }
    add('Sofa · IKEA', 'Shopping', 9000, new Date())
  } },
  empty: { seed: false, plan: 'active', mutate: () => {
    const s = window.__finance.getState()
    for (const e of [...s.incomeEvents]) s.deleteIncomeEvent(e.id)
  } },
  // A member past setup with nothing this month yet (mockup state-emptyflow "Nothing in November yet"): one expense last
  // month is the history that turns the setup card into the empty-month state. Idempotent, so it can run on every load.
  emptyMonth: { seed: false, plan: 'active', everyLoad: true, mutate: () => {
    const s = window.__finance.getState()
    for (const e of [...s.incomeEvents]) s.deleteIncomeEvent(e.id)
    const fp = s.profile.financialProfile ?? {}
    if (!fp.onboarding?.doneAt) {
      const now = new Date().toISOString()
      s.updateProfile({ financialProfile: { ...fp, onboarding: { v: 1, step: 99, startedAt: now, doneAt: now } } })
    }
    if (s.expenses.length) return
    const d = new Date()
    d.setDate(0)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    s.addExpense({ description: 'Talabat', category: 'Food', amount: 245, currency: 'EGP', paymentMethodId: s.paymentMethods[0]?.id ?? 'pm_default_cash', isRecurring: false, date: iso })
  } },
  learning: { seed: false, plan: 'active', mutate: () => {
    const s = window.__finance.getState()
    const pm = s.paymentMethods[0]?.id ?? 'pm_default_cash'
    const today = new Date().toISOString().slice(0, 10)
    s.addExpense({ description: 'Talabat', category: 'Food', amount: 245, currency: 'EGP', paymentMethodId: pm, isRecurring: false, date: today })
  } },
  noIncome: { seed: true, plan: 'active', everyLoad: true, mutate: () => {
    const s = window.__finance.getState()
    for (const e of [...s.incomeEvents]) s.deleteIncomeEvent(e.id)
    for (const src of [...s.incomeSources]) s.deleteIncomeSource(src.id)
  } },
}

/**
 * Live gold prices for the Wealth screens (A3). The local server has no Supabase, so the asset_prices cache is filled
 * through the dev-exposed store.
 */
const livePrices = () => async (page) => {
  await page.evaluate(() => {
    const now = new Date().toISOString()
    const rows = [['XAU_24K', 3670], ['XAU_21K', 3210], ['XAU_18K', 2750]]
    const map = Object.fromEntries(rows.map(([symbol, price]) => [`${symbol}:EGP`, { symbol, currency: 'EGP', price, asOf: now, assetClass: 'gold', confidence: 'high' }]))
    window.__prices?.getState().setPrices(map)
    window.__finance.setState({ goldPricePerGram: 3670, goldPriceAvailable: true })
  })
  await page.waitForTimeout(800)
}
/**
 * Types an amount into the open sheet's nth visible decimal field, as the mockup fills its add sheets ("2,000 EGP").
 * An empty add sheet reading 0 is not a difference worth flagging, so the comparison starts from the mockup's figure.
 */
const amount = (value, nth = 0) => async (page) => {
  const input = page.locator('[role=dialog] input[inputmode=decimal]').locator('visible=true').nth(nth)
  await input.click()
  await input.fill(value)
  await settle(page, 500)
}
/** Taps a Wealth plan row (emergency fund, zakat) at the end of the page. */
const planRow = (text) => async (page) => {
  const row = page.locator('button', { hasText: text }).last()
  await row.scrollIntoViewIfNeeded()
  await row.click()
  await settle(page, 900)
}

/**
 * Mockup screen -> how to reach it. `offline` = fake offline (Accounts crashes online with empty Supabase env).
 * `steps` are tap labels (aria-label, role name or text) or functions. `blocked` = cannot be reached, with the reason.
 */
const SCREENS = [
  { name: 'page-flow', route: '/flow' },
  { name: 'page-accounts', route: '/accounts', offline: true },
  // No mockup png: the mockup draws this view when S.st.prov is set (lt-accounts.js providerView). App shot only.
  { name: 'page-provider', route: '/accounts', offline: true, steps: ['CIB, 2 accounts · 3 cards'] },
  { name: 'page-budget', route: '/budget' },
  { name: 'page-debts', route: '/debts' },
  { name: 'page-goals', route: '/goals' },
  { name: 'page-insights', route: '/reports' },
  { name: 'page-paydays', route: '/paydays' },
  { name: 'page-subs', route: '/subscriptions' },
  { name: 'page-wealth', route: '/wealth', steps: [livePrices()] },

  { name: 'sheet-expense', route: '/flow', steps: ['Talabat'] },
  { name: 'sheet-income', route: '/flow', steps: ['Salary · Nexta'] },
  { name: 'sheet-scan', route: '/flow', steps: ['Carrefour'] },
  { name: 'sheet-s_held', blocked: 'Held bank messages are fetched from Supabase (HeldMessagesSheet); with empty Supabase env there are none, so the Flow row never shows.' },

  { name: 'sheet-account', route: '/accounts', offline: true, steps: ['CIB, 2 accounts · 3 cards', 'CIB Current'] },
  { name: 'sheet-card', route: '/accounts', offline: true, steps: ['CIB, 2 accounts · 3 cards', 'CIB Credit'] },
  { name: 'sheet-addaccount', route: '/accounts', offline: true, steps: ['Add account'] },
  { name: 'sheet-addcard', route: '/accounts', offline: true, steps: ['CIB, 2 accounts · 3 cards', 'CIB Current', 'Add card'] },
  { name: 'sheet-cashout', route: '/accounts', offline: true, steps: ['CIB, 2 accounts · 3 cards', 'CIB Current', 'Cash out', amount('2000')] },
  { name: 'sheet-setaside', route: '/accounts', offline: true, steps: ['CIB, 2 accounts · 3 cards', 'CIB Current', 'Set aside', amount('2000')] },
  { name: 'sheet-cashhand', route: '/accounts', offline: true, steps: ['Start tracking'] },
  { name: 'state-cashoff', route: '/accounts', offline: true, scroll: 'Start tracking' },

  { name: 'sheet-deposit', route: '/wealth', steps: ['Add money', amount('5000')] },
  // The mockup's state: from the Trip pocket, paying a debt (the app opens on Spending; both are one tap).
  { name: 'sheet-s_withdraw', route: '/wealth', steps: ['Withdraw', 'css=[role=dialog] button[aria-label^="From:"]', 'Trip to Dahab', 'css=[role=dialog] button:has-text("For")', 'Pay a debt', amount('2000')] },
  { name: 'sheet-s_ef', route: '/wealth', steps: [planRow(/months covered|Not set up yet/)] },
  { name: 'sheet-efmonth', route: '/wealth', steps: [planRow(/months covered|Not set up yet/), 'A simple month'] },
  { name: 'sheet-s_gold', route: '/wealth', steps: [livePrices(), 'Add pocket or asset', 'Investment', 'css=[role=dialog] button:has-text("Bars, coins")', amount('8'), amount('32200', 1)] },
  { name: 'sheet-s_zakat', route: '/wealth', steps: [livePrices(), planRow(/ due/)] },
  { name: 'sheet-s_goal', route: '/goals', steps: ['Trip to Dahab'] },
  { name: 'sheet-goal', route: '/goals', steps: ['Trip to Dahab', 'Add money', amount('2000')] },
  { name: 'sheet-addgoalC', route: '/goals', steps: ['New goal'] },
  { name: 'sheet-celebrate', route: '/goals', steps: [async (page) => {
    // "You did it" shows when a goal crosses 100% after it was seen: fill Umrah 2027's pocket to its target.
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.__finance.setState((s) => ({ savingsAccounts: s.savingsAccounts.map((a) => (a.name === 'Umrah 2027' ? { ...a, currentBalance: 30000 } : a)) })))
    await page.waitForTimeout(2500)
  }] },

  { name: 'sheet-s_borrow', route: '/debts', steps: ['Add', 'Borrowed money'] },
  { name: 'sheet-s_install', route: '/debts', steps: ['Add', 'Installment plan'] },
  { name: 'sheet-s_vault', route: '/debts', steps: ['1 cleared debt · 18,000 paid off'] },
  { name: 'sheet-debtpay', route: '/debts', steps: ['Installments', 'Car loan', 'Record a payment'] },
  { name: 'sheet-repaid', route: '/debts', steps: ['Owed to you', 'Record money back'] },
  // The mockup logs the salary payday, straight from the Paydays hero.
  { name: 'sheet-received', route: '/paydays', steps: ['Log a payday'] },
  { name: 'sheet-s_payday', route: '/paydays', steps: ['Paydays and pay cycle', 'Add a payday'] },

  { name: 'sheet-sub', route: '/subscriptions', steps: ['Netflix'] },
  { name: 'sheet-s_subadd', route: '/subscriptions', steps: ['Add subscription', 'Netflix EGP', 'Premium'] },
  { name: 'sheet-s_subcancel', route: '/subscriptions', steps: ['Netflix', 'Cancel subscription'] },
  { name: 'sheet-s_line', route: '/budget', steps: ['Utilities'] },
  { name: 'sheet-s_fixgap', blocked: 'Needs an SMS balance report: useAccountGaps reads latest_balance_reports from Supabase, which this server has no URL for.' },

  { name: 'state-emptydebts', route: '/debts', state: 'empty' },
  { name: 'state-emptyflow', route: '/flow', state: 'emptyMonth' },
  { name: 'state-emptysubs', route: '/subscriptions', state: 'empty' },
  { name: 'state-insfree', route: '/reports', state: 'free' },
  { name: 'state-inslearn', route: '/reports', state: 'learning', offline: true },
  { name: 'state-insnoinc', route: '/reports', state: 'noIncome' },
  { name: 'state-loading', route: '/flow', steps: [async (page) => { await page.evaluate(() => window.__finance.getState().setDataReady(false)); await page.waitForTimeout(800) }] },
  { name: 'state-noresults', route: '/flow', steps: ['Open filters', 'css=[role=dialog] button:has-text("Today")', 'css=[role=dialog] :text("Rent")', async (page) => {
    await page.getByRole('button', { name: /^Show \d+ results?$|^No results$/ }).first().click()
    await settle(page, 800)
  }] },
  { name: 'state-buddgy', blocked: 'Buddgy quick-add card comes from an AI reply; the AI route needs a signed-in Supabase session and a model key.' },
]

/**
 * Computed-style checks for the visible page. The hero is the first dark or gradient block (outside any open sheet)
 * of at least 75% width that starts within 260px under the app header.
 */
function checksInPage() {
  const body = getComputedStyle(document.body)
  const vw = document.documentElement.clientWidth
  const header = document.querySelector('header')
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0
  const transparent = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c)
  const bodyBg = body.backgroundColor
  const luminance = (c) => {
    const n = (c.match(/[\d.]+/g) ?? ['1', '1', '1']).map(Number)
    if (/^ok?lch|^ok?lab/.test(c)) return c.includes('%') && n[0] > 1 ? n[0] / 100 : n[0]
    const scale = c.startsWith('color(') ? 1 : 255
    return (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / scale
  }
  let hero = null
  const root = document.querySelector('main') ?? document.body
  for (const el of root.querySelectorAll('section, div')) {
    const r = el.getBoundingClientRect()
    if (r.top < headerBottom - 1 || r.top > 260 || r.height < 90 || r.width < vw * 0.75) continue
    if (el.closest('[role=dialog]')) continue
    const cs = getComputedStyle(el)
    const painted = /gradient|url\(/.test(cs.backgroundImage) || (!transparent(cs.backgroundColor) && cs.backgroundColor !== bodyBg && luminance(cs.backgroundColor) < 0.45)
    if (!painted) continue
    hero = {
      selector: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join('.')}`,
      borderRadius: cs.borderRadius,
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      left: Math.round(r.left),
      right: Math.round(vw - r.right),
      width: Math.round(r.width),
      viewportWidth: vw,
      shape: parseFloat(cs.borderTopLeftRadius) > 0 && r.left > 0 ? 'rounded card' : r.left <= 0 && r.width >= vw - 1 ? 'full bleed' : 'other',
    }
    break
  }
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  return {
    bodyFont: body.fontFamily,
    geist: /geist/i.test(body.fontFamily),
    hero,
    horizontalOverflow: sw > vw,
    scrollWidth: sw,
    viewportWidth: vw,
    sheetOpen: Boolean(document.querySelector('[role=dialog]')),
  }
}

async function composite(name) {
  const mock = path.join(MOCK, `${name}.png`)
  const app = path.join(APP, `${name}.png`)
  // A screen with no mockup png (page-provider) keeps only its app shot.
  if (!fs.existsSync(mock)) return false
  const H = 1688
  const left = await sharp(mock).resize({ height: H }).png().toBuffer()
  const right = await sharp(app).resize({ height: H }).png().toBuffer()
  const lw = (await sharp(left).metadata()).width
  const rw = (await sharp(right).metadata()).width
  const GAP = 40, TOP = 64
  const label = (x, text) => `<text x="${x}" y="44" font-family="Helvetica, Arial" font-size="30" font-weight="700" fill="#333">${text}</text>`
  const svg = Buffer.from(`<svg width="${lw + GAP + rw}" height="${TOP}" xmlns="http://www.w3.org/2000/svg">${label(8, `${name} · mockup`)}${label(lw + GAP + 8, 'app')}</svg>`)
  await sharp({ create: { width: lw + GAP + rw, height: H + TOP, channels: 3, background: '#e6e6e6' } })
    .composite([{ input: svg, left: 0, top: 0 }, { input: left, left: 0, top: TOP }, { input: right, left: lw + GAP, top: TOP }])
    .png()
    .toFile(path.join(CMP, `${name}.png`))
}

async function main() {
  const filters = process.argv.slice(2)
  const screens = SCREENS.filter((s) => !filters.length || filters.some((f) => s.name.includes(f)))
  fs.mkdirSync(APP, { recursive: true })
  fs.mkdirSync(CMP, { recursive: true })
  const checksPath = path.join(CMP, 'checks.json')
  const report = fs.existsSync(checksPath) && filters.length ? JSON.parse(fs.readFileSync(checksPath, 'utf8')) : { screens: {} }
  report.generatedAt = new Date().toISOString()

  const browser = await launch()
  const states = {}
  try {
    for (const s of screens) {
      if (s.blocked) {
        report.screens[s.name] = { captured: false, reason: s.blocked }
        console.log(`SKIP ${s.name}: ${s.blocked}`)
        continue
      }
      const key = s.state ?? 'full'
      states[key] ??= await seededState(browser, STATES[key])
      const { ctx, page } = await phoneContext(browser, { storageState: states[key], offline: s.offline })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
      try {
        await go(page, s.route)
        await page.evaluate((p) => window.__qa.plan(p), STATES[key].plan)
        if (STATES[key].everyLoad) await page.evaluate(STATES[key].mutate)
        await settle(page, 600)
        if (s.scroll) {
          await page.getByRole('button', { name: s.scroll }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
          await page.waitForTimeout(500)
        }
        for (const step of s.steps ?? []) {
          if (typeof step === 'function') await step(page)
          else await tap(page, step)
        }
        await settle(page, 1000)
        await page.screenshot({ path: path.join(APP, `${s.name}.png`) })
        await composite(s.name)
        report.screens[s.name] = { captured: true, route: s.route, steps: (s.steps ?? []).map(String).map((x) => x.slice(0, 60)), offline: Boolean(s.offline), state: key, checks: await page.evaluate(checksInPage), pageErrors: [...new Set(errors)] }
        console.log(`OK   ${s.name}`)
      } catch (e) {
        const reason = e.message.split('\n')[0]
        report.screens[s.name] = { captured: false, route: s.route, reason, pageErrors: [...new Set(errors)] }
        console.log(`FAIL ${s.name}: ${reason}`)
      } finally {
        await ctx.close()
      }
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(checksPath, JSON.stringify(report, null, 2) + '\n')
}

await main()
