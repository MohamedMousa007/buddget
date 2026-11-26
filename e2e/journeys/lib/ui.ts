import { expect, type Locator, type Page } from '@playwright/test'

export const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name })

/** BDG-026-028: a money sheet's Into/From pocket is one field that opens the provider-style picker over the pockets. */
export async function pickPocket(page: Page, sheet: Locator, leg: 'Into' | 'From', name: RegExp) {
  const field = sheet.getByRole('button', { name: new RegExp(`^${leg}`) })
  if (name.test((await field.getAttribute('aria-label')) ?? '')) return
  await field.click()
  const picker = dialog(page, 'Choose a pocket')
  await picker.getByRole('radio', { name }).click()
  await expect(picker).toBeHidden()
  await expect(field).toHaveAttribute('aria-label', new RegExp(`^${leg}: ${name.source}`))
}

/** Payment-method carousel: walk it with the keyboard (its accessible path) until the active card matches, then Enter. */
export async function pickMethod(page: Page, name: RegExp) {
  const sheet = dialog(page, 'Payment methods')
  await sheet.waitFor()
  const group = sheet.getByRole('group').first()
  await group.focus()
  for (let i = 0; i < 10; i++) await group.press('ArrowLeft')
  for (let i = 0; i < 12; i++) {
    const label = (await group.getAttribute('aria-label')) ?? ''
    if (name.test(label)) {
      await group.press('Enter')
      await expect(sheet).toBeHidden()
      return
    }
    await group.press('ArrowRight')
  }
  throw new Error(`payment method ${name} not found in carousel`)
}

/** A sheet's account or method: its chip when the sheet lists chips, else the method field that opens the carousel. */
export async function chooseMethod(page: Page, sheet: Locator, name: string) {
  const chip = sheet.getByRole('button', { name, exact: true })
  if (await chip.count()) return chip.first().click()
  await sheet.getByRole('button', { name: /EGP$/ }).filter({ hasNotText: 'E£' }).last().click()
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
  await d.getByRole('radio', { name: o.category, exact: true }).click()
  if (o.method) {
    await d.getByRole('button', { name: /EGP$/ }).filter({ hasNotText: 'Egyptian' }).last().click()
    await pickMethod(page, o.method)
  }
  await blur(page)
  await d.getByRole('button', { name: 'Save expense' }).click()
  await expect(d).toBeHidden()
  // The first expense paid with Cash asks once how much cash the user has (S1 covers answering it).
  const ask = dialog(page, 'How much cash do you have right now?')
  if (await ask.isVisible({ timeout: 1500 }).catch(() => false)) {
    await ask.getByRole('button', { name: 'Not now' }).click()
    await expect(ask).toBeHidden()
  }
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

/** Add-account sheet (shared by onboarding and Accounts). */
export async function fillAccountSheet(page: Page, o: { kind: 'Bank' | 'Wallet' | 'Cash'; provider?: RegExp; balance: number }) {
  const d = dialog(page, 'Add an account')
  await d.waitFor()
  const kind = d.getByRole('radio', { name: o.kind, exact: true })
  if ((await kind.getAttribute('aria-checked')) !== 'true') await kind.click()
  if (o.provider) {
    await d.getByRole('button', { name: 'Bank or wallet' }).click()
    await dialog(page, 'Choose provider').getByRole('radio', { name: o.provider }).click()
  }
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.balance))
  await blur(page)
  await d.getByRole('button', { name: 'Add account', exact: true }).click()
  await expect(d).toBeHidden()
}

/** Accounts tab > Add account (or the empty-state "Add one myself"). */
export async function addAccount(page: Page, o: { kind: 'Bank' | 'Wallet' | 'Cash'; provider?: RegExp; balance: number }) {
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
  await dialog(page, 'Add debt').getByRole('button', { name: /^Borrow / }).click()
  const d = dialog(page, 'New borrow')
  await d.getByRole('textbox', { name: 'e.g. Ahmed' }).fill(o.person)
  await d.getByRole('textbox', { name: 'e.g. Rent help' }).fill(o.what)
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await blur(page)
  await d.getByRole('button', { name: 'Add borrow' }).click()
  await expect(d).toBeHidden()
}

/** Debts > Pay <debt>, choosing the method chip by its visible name (index picks among same-named chips). */
export async function payDebt(page: Page, o: { debt: string; amount: number; method: string; nth?: number }) {
  await page.getByRole('button', { name: `Pay ${o.debt}` }).click()
  const d = dialog(page, 'Make a payment')
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await d.getByRole('button', { name: o.method, exact: true }).nth(o.nth ?? 0).click()
  await d.getByRole('button', { name: /^Pay [\d,]+ EGP$/ }).click()
  await expect(d).toBeHidden()
}

/** Touch layouts hide sheet CTAs while the on-screen keyboard would be up; drop focus first, as a user closing the keyboard would. */
export async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.waitForTimeout(250)
}
