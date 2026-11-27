import { expect, type Locator, type Page } from '@playwright/test'

export const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name })

/** BDG-026-028: a money sheet's Into/From pocket is one field that opens the provider-style picker over the pockets. */
export async function pickPocket(page: Page, sheet: Locator, leg: 'Into' | 'From' | 'To', name: RegExp) {
  // "Into: Monthly Savings" once chosen; just "Into" while it still says Choose a pocket.
  const field = sheet.getByRole('button', { name: new RegExp(`^${leg}(:|$)`) })
  if (name.test((await field.getAttribute('aria-label')) ?? '')) return
  await field.click()
  // Light touch: "Which pocket?" (grouped by purpose); older builds titled it "Choose a pocket".
  const picker = dialog(page, /^(Which pocket\?|Choose a pocket)$/)
  await picker.getByRole('radio', { name }).click()
  await expect(picker).toBeHidden()
  await expect(field).toHaveAttribute('aria-label', new RegExp(`^${leg}: ${name.source.replace(/^\^/, '').replace(/\$$/, '')}`))
}

/** Wealth > Withdraw: the purpose is a "For" field that opens "What is it for?" (Spending, Pay a debt, Income: Back into this month, …). */
export async function withdrawFor(page: Page, sheet: Locator, purpose: RegExp) {
  const field = sheet.getByRole('button', { name: /^For / })
  if (purpose.test(((await field.getAttribute('aria-label')) ?? (await field.textContent()) ?? '').replace(/^For /, ''))) return
  await field.click()
  const picker = dialog(page, 'What is it for?')
  await picker.getByRole('radio', { name: purpose }).click()
  await expect(picker).toBeHidden()
}

/** Payment-method carousel: walk it with the keyboard (its accessible path) until the active card matches, then Enter. */
export async function pickMethod(page: Page, name: RegExp, nth = 0, title: string | RegExp = /^(Payment methods|طرق الدفع)$/) {
  const sheet = dialog(page, title)
  await sheet.waitFor()
  const group = sheet.getByRole('group').first()
  await group.focus()
  for (let i = 0; i < 10; i++) await group.press('ArrowLeft')
  for (let i = 0; i < 12; i++) {
    const label = (await group.getAttribute('aria-label')) ?? ''
    if (name.test(label) && nth-- <= 0) {
      await group.press('Enter')
      await expect(sheet).toBeHidden()
      return
    }
    await group.press('ArrowRight')
  }
  throw new Error(`payment method ${name} not found in carousel`)
}

/**
 * A sheet's account or method: its chip when the sheet lists chips, else (light touch) the method field ("Paid from",
 * "Received in", "Paid with", "Into", "From") that opens the carousel.
 */
export async function chooseMethod(page: Page, sheet: Locator, name: string) {
  const chip = sheet.getByRole('button', { name, exact: true })
  if (await chip.count()) return chip.first().click()
  const field = sheet.getByRole('button', { name: /^(Paid from|Received in|Paid with|Into|From)\b/ }).first()
  if (((await field.getAttribute('aria-label')) ?? '').endsWith(`: ${name}`)) return
  await field.click()
  await pickMethod(page, new RegExp(`^${name}`))
}

/** Opens the global + and one of its entries. */
export async function quickAdd(page: Page, entry: RegExp) {
  await page.getByRole('button', { name: 'Quick add' }).click()
  await dialog(page, 'Add').getByRole('button', { name: entry }).click()
}

export async function addExpense(page: Page, o: { amount: number; description: string; category: string; method?: RegExp }) {
  await quickAdd(page, /^Expense/)
  const d = dialog(page, 'Add expense')
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await d.getByRole('textbox', { name: 'Description' }).fill(o.description)
  await pickCategory(page, d, o.category)
  if (o.method) {
    await d.getByRole('button', { name: /^Paid with/ }).click()
    await pickMethod(page, o.method)
  }
  await blur(page)
  await d.getByRole('button', { name: 'Save expense' }).click()
  await expect(d).toBeHidden()
  // The first expense paid with Cash asks once how much cash the user has (S1 covers answering it). Light touch: the
  // "Cash on hand · Counted today" sheet, which has no "Not now"; closing it is the skip.
  const ask = dialog(page, /^(How much cash do you have right now\?|Cash on hand)$/)
  if (await ask.isVisible({ timeout: 3000 }).catch(() => false)) {
    const notNow = ask.getByRole('button', { name: 'Not now' })
    if (await notNow.count()) await notNow.click()
    else await ask.getByRole('button', { name: 'Close' }).first().click()
    await expect(ask).toBeHidden()
  }
}

/** Light touch: an entry sheet's category sits behind a "Category › Choose" row that opens the category list. */
export async function pickCategory(page: Page, sheet: Locator, category: string) {
  await sheet.getByRole('button', { name: /^Category/ }).click()
  const picker = dialog(page, 'Category')
  await picker.getByRole('radio', { name: new RegExp(`^${category}( |$)`) }).click()
  await expect(picker).toBeHidden()
}

export async function addMoneyIn(page: Page, o: { amount: number; name: string; method?: RegExp }) {
  await quickAdd(page, /^Money in/)
  const d = dialog(page, 'Log money in')
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await d.getByRole('textbox', { name: 'Name' }).fill(o.name)
  if (o.method) {
    await d.getByRole('button', { name: /^Received in/ }).click()
    await pickMethod(page, o.method)
  }
  await blur(page)
  await d.getByRole('button', { name: 'Save income', exact: true }).click()
  await expect(d).toBeHidden()
}

/**
 * Add-account sheet (Accounts). Light touch: Bank/Wallet tabs, "Balance today", and a "Bank › Choose" (or "Wallet › Choose")
 * row that opens the provider picker. On Accounts, Cash is the untracked "Cash on hand" row, whose "Start tracking" asks
 * for the amount (`trackCash`); onboarding's Cash button opens a "Cash on hand" sheet.
 */
export async function fillAccountSheet(page: Page, o: { kind: 'Bank' | 'Wallet' | 'Cash'; provider?: RegExp; balance: number }) {
  if (o.kind === 'Cash') {
    // Onboarding's Cash opens its own "Cash on hand" sheet: one balance, no provider.
    const c = dialog(page, 'Cash on hand')
    await c.getByRole('textbox', { name: 'Balance today' }).fill(String(o.balance))
    await blur(page)
    await c.getByRole('button', { name: 'Add account', exact: true }).click()
    await expect(c).toBeHidden()
    return
  }
  const d = dialog(page, 'Add an account')
  await d.waitFor()
  const kind = d.getByRole('radio', { name: o.kind, exact: true })
  if ((await kind.getAttribute('aria-checked')) !== 'true') await kind.click()
  if (o.provider) {
    await d.getByRole('button', { name: new RegExp(`^${o.kind} `) }).click()
    const picker = dialog(page, 'Choose provider')
    await picker.getByRole('radio', { name: o.provider }).first().click()
    await expect(picker).toBeHidden()
  }
  await d.getByRole('textbox', { name: 'Balance today' }).fill(String(o.balance))
  await blur(page)
  await d.getByRole('button', { name: 'Add account', exact: true }).click()
  await expect(d).toBeHidden()
}

/** Accounts > the untracked "Cash on hand" row > Start tracking, with the amount counted today. */
export async function trackCash(page: Page, balance: number) {
  await page.goto('/accounts', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Start tracking' }).click({ timeout: 60_000 })
  const d = dialog(page, 'Cash on hand')
  await d.getByRole('textbox', { name: 'Cash on hand' }).fill(String(balance))
  await blur(page)
  await d.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(d).toBeHidden()
}

/** Accounts tab > Add account (or the empty-state "Add one myself"). */
export async function addAccount(page: Page, o: { kind: 'Bank' | 'Wallet' | 'Cash'; provider?: RegExp; balance: number }) {
  if (o.kind === 'Cash') return trackCash(page, o.balance)
  await page.goto('/accounts', { waitUntil: 'domcontentloaded' })
  const first = page.getByRole('button', { name: 'Add one myself' })
  const more = page.getByRole('button', { name: 'Add account' }).first()
  await expect(first.or(more)).toBeVisible({ timeout: 60_000 })
  if (await first.isVisible()) await first.click()
  else await more.click()
  await fillAccountSheet(page, o)
}

export async function text(l: Locator): Promise<string> {
  return ((await l.textContent()) ?? '').replace(/\s+/g, ' ').trim()
}

export async function addBorrow(page: Page, o: { person: string; what: string; amount: number }) {
  await page.goto('/debts', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^(Add a debt|New debt)$/ }).first().click()
  // Light touch: "Add a debt" lists the kinds as radios; "Borrowed money" opens the borrow form.
  await dialog(page, 'Add a debt').getByRole('radio', { name: /^Borrowed money/ }).click()
  const d = dialog(page, 'New borrow')
  await d.getByRole('textbox', { name: 'Person', exact: true }).fill(o.person)
  await d.getByRole('textbox', { name: 'For', exact: true }).fill(o.what)
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await blur(page)
  await d.getByRole('button', { name: 'Add borrow' }).click()
  await expect(d).toBeHidden()
}

/**
 * Debts > a debt row > its detail sheet's CTA ("Add payment", or "Pay 1,400" for an installment; v9), then the
 * "Paid from" field's carousel. `nth` picks among same-named methods in the carousel.
 */
export async function payDebt(page: Page, o: { debt: string; amount: number; method: string; nth?: number }) {
  await page.getByRole('button', { name: new RegExp(`^${o.debt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first().click()
  await dialog(page, o.debt).getByRole('button', { name: /^(Add payment|Pay [\d,]+)$/ }).click()
  const d = dialog(page, 'Make a payment')
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  const from = d.getByRole('button', { name: /^Paid from/ })
  if (!((await from.getAttribute('aria-label')) ?? '').endsWith(`: ${o.method}`) || o.nth) {
    await from.click()
    await pickMethod(page, new RegExp(`^${o.method}`), o.nth ?? 0)
  }
  await blur(page)
  await d.getByRole('button', { name: /^(Record payment|Pay [\d,]+ EGP)$/ }).click()
  await expect(d).toBeHidden()
}

/** Touch layouts hide sheet CTAs while the on-screen keyboard would be up; drop focus first, as a user closing the keyboard would. */
export async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.waitForTimeout(250)
}

/**
 * Light touch shows whole amounts without decimals ("20,000 EGP", "1,880"), a fraction only when there is one ("85.50").
 * Matches the amount as a whole number on screen: not part of a longer number, so "750" never matches "1,750".
 */
export function shown(amount: string): RegExp {
  const esc = amount.replace(/\.00$/, '').replace(/[.,]/g, (c) => `\\${c}`)
  return new RegExp(`(?<![\\d,.])${esc}(?![\\d]|[.,]\\d)`)
}

/**
 * Light touch: a bank row on Accounts opens its provider page ("Total here"); the account row there opens the account
 * sheet (balance, Cash out, Set aside, cards, Recent). Returns that sheet. A Cash row opens its sheet directly.
 */
export async function openAccount(page: Page, name: RegExp | string) {
  const by = typeof name === 'string' ? { name, exact: true } : { name }
  await page.goto('/accounts', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', by).first().click({ timeout: 60_000 })
  // The account sheet: its balance is a "Balance …, tap the amount to change it" button (Cash has no Cash out).
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^Balance / }) }).last()
  // A bank or wallet row opens its provider page first; a Cash row opens its sheet straight away.
  const provider = page.locator('main').getByText('Total here', { exact: true })
  await expect(provider.or(sheet).first()).toBeVisible()
  if (await provider.isVisible()) await page.locator('main').getByRole('button', by).last().click()
  await sheet.waitFor()
  return sheet
}
