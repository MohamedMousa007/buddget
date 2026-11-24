/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// Owner evidence for the L1 fixes A, C and D at 390 px, in English and Arabic: Wealth > Add money on a held pocket
// (the holder is the default source), another source shown as a transfer and refused past its free money, both pocket
// delete warnings (money stays in the account / leaves net worth), and a borrowed Flow row whose "Not income" badge
// wraps under the title. Screenshots go to docs/qa/round3/evidence/; the checks only make sure each shot shows its point.
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { env } from '../../lib/env'
import { expect, localWait, test } from '../../lib/fixtures'
import { blur, dialog } from '../../lib/ui'
import { bank, localMethod, seed } from './seed'

const EVIDENCE = resolve(__dirname, '../../../../docs/qa/round3/evidence')
const HELD = 'QA Ev Rainy'
const LOOSE = 'QA Ev Jar'
/** Long enough that the title and the badge do not fit on one line at 390 px. */
const TITLE = 'Instapay credit from Ahmed Mostafa'
const hourAgo = () => new Date(Date.now() - 3_600_000).toISOString()
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

const COPY = {
  en: { addMoney: 'Add money', del: 'Delete', fromAccount: 'From account', transfer: 'Transfer from QNB Alahli to CIB', over: /Only 1,000(\.00)? EGP is available in QNB Alahli/, stays: 'stays in CIB', leaves: 'will leave your net worth', notIncome: 'Not income' },
  ar: { addMoney: 'إضافة مال', del: 'حذف', fromAccount: 'من حساب', transfer: 'تحويل من QNB Alahli إلى CIB', over: /المتاح في QNB Alahli هو/, stays: 'في CIB ويعود متاحًا', leaves: 'من صافي ثروتك', notIncome: 'ليس دخلًا' },
}
type Lang = keyof typeof COPY

const shot = async (target: Page | Locator, name: string) => {
  mkdirSync(EVIDENCE, { recursive: true })
  // Sheets and dialogs animate in; let them settle so the shot is not half-faded.
  await new Promise((r) => setTimeout(r, 800))
  await target.screenshot({ path: `${EVIDENCE}/${name}.png` })
}

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(1500)
}

/** The language lives in user_settings (a pull overwrites the local copy) and in the persisted store. */
async function useLanguage(page: Page, userId: string, lang: Lang) {
  if (lang === 'en') return
  const key = env('SUPABASE_SECRET_KEY')
  const r = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/user_settings?user_id=eq.${userId}`, {
    method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ language: 'ar' }),
  })
  expect(r.status).toBeLessThan(300)
  await page.evaluate(() => {
    const k = 'buddget-storage'
    const j = JSON.parse(localStorage.getItem(k) ?? '{"state":{},"version":0}')
    j.state.settings = { ...(j.state.settings ?? {}), language: 'ar' }
    localStorage.setItem(k, JSON.stringify(j))
    document.cookie = 'bdg-lang=ar; path=/'
  })
  await open(page, '/wealth')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
}

async function pocketMenu(page: Page, pocket: string, item: string) {
  await open(page, '/wealth')
  await page.getByRole('button', { name: new RegExp(pocket) }).first().click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** Two accounts (CIB 5,000, QNB 1,000), a pocket held in CIB (500) and one outside every account (300). */
async function setup(page: Page, userId: string) {
  const [cib] = await seed(page, userId, 'payment_methods', [bank('CIB', 5000, { opening_at: hourAgo() })])
  const [qnb] = await seed(page, userId, 'payment_methods', [bank('QNB Alahli', 1000, { opening_at: hourAgo() })])
  await seed(page, userId, 'savings_accounts', [
    { name: HELD, type: 'bank', category: 'savings', currency: 'EGP', current_balance: 500, opening_balance: 500, held_in_payment_method_id: cib.id },
    { name: LOOSE, type: 'cash', category: 'savings', currency: 'EGP', current_balance: 300, opening_balance: 300, held_in_payment_method_id: null },
  ])
  await localMethod(page, cib.id)
  await localMethod(page, qnb.id)
  await localWait(page, (s) => s.savingsAccounts.filter((a: any) => a.name === HELD || a.name === LOOSE).length === 2)
  await seed(page, userId, 'debts', [{ name: 'QA Ev borrow', person: 'Ahmed', amount: 3000, remaining_amount: 3000, currency: 'EGP', debt_type: 'personal', direction: 'i_owe', status: 'active' }])
  const debt = await localWait(page, (s) => s.debts.find((d: any) => d.name === 'QA Ev borrow'))
  await seed(page, userId, 'income_events', [{ name: TITLE, amount: 3000, currency: 'EGP', source_type: 'other', status: 'confirmed', received_date: today(), payment_method_id: cib.id, occurred_at: new Date().toISOString(), linked_debt_id: debt.id }])
}

for (const lang of ['en', 'ar'] as const) {
  test(`E1 ${lang} evidence for L1-A, L1-C and L1-D at 390 px`, async ({ page, user }) => {
    const c = COPY[lang]
    await setup(page, user.id)
    await useLanguage(page, user.id, lang)

    // A: the holder is the default source; nothing moves between accounts.
    await pocketMenu(page, HELD, c.addMoney)
    const d = dialog(page, c.addMoney)
    await d.getByRole('textbox').first().fill('2000')
    await blur(page)
    const from = d.getByRole('button', { name: new RegExp(`^${c.fromAccount}`) })
    await expect(from).toContainText('CIB')
    await expect(d.getByRole('alert')).toHaveCount(0)
    await shot(page, `l1a-add-money-held-default-cib-${lang}`)

    // A: another source is a transfer, refused past its own free money.
    await from.click()
    await d.getByRole('option', { name: /^QNB Alahli/ }).click()
    await expect(d).toContainText(c.transfer)
    await expect(d.getByRole('alert')).toContainText(c.over)
    await shot(page, `l1a-add-money-transfer-refused-${lang}`)
    await page.keyboard.press('Escape')

    // C: the warning follows the net worth change.
    await pocketMenu(page, HELD, c.del)
    const stays = page.getByRole('alertdialog')
    await expect(stays).toContainText(c.stays)
    await shot(page, `l1c-delete-held-stays-${lang}`)
    await page.keyboard.press('Escape')
    await pocketMenu(page, LOOSE, c.del)
    const leaves = page.getByRole('alertdialog')
    await expect(leaves).toContainText(c.leaves)
    await shot(page, `l1c-delete-outside-leaves-${lang}`)
    await page.keyboard.press('Escape')

    // D: the borrowed row keeps its whole title and wraps the badge under it.
    await open(page, '/flow')
    const row = page.locator('main').getByRole('button').filter({ hasText: TITLE }).first()
    await expect(row).toContainText(c.notIncome)
    await shot(row, `l1d-flow-borrowed-not-income-${lang}`)
  })
}
