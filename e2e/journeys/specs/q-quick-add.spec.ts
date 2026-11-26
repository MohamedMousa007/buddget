/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads the untyped persisted store */
import type { Page } from '@playwright/test'
import { expect, goto as gotoTab, localWait, test } from '../lib/fixtures'
import { addAccount, addBorrow, addExpense, addMoneyIn, blur, dialog } from '../lib/ui'

/** The Add sheet's tiles, top-left to bottom-right, as the accessible name starts. */
const TILES = [/^Expense/, /^Money in/, /^Receipt/, /^Pay debt/, /^Savings/, /^Subscription/, /^Add by voice/]

const fab = (page: Page) => page.getByRole('button', { name: 'Quick add' }).first()
const addSheet = (page: Page) => dialog(page, 'Add')
/** The sheet a tile opened: any dialog that is not the Add menu itself. */
const childSheet = (page: Page) => page.getByRole('dialog').filter({ hasNot: page.getByRole('heading', { name: 'Add', exact: true }) }).last()

/** Opens any app screen and waits for the + (sub-pages like Plan history have neither the profile button nor "Back to Flow"). */
async function goto(page: Page, path: string) {
  if (path === '/flow') return gotoTab(page, path)
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(fab(page)).toBeVisible({ timeout: 60_000 })
}

async function openTile(page: Page, tile: RegExp) {
  await fab(page).click()
  await addSheet(page).getByRole('button', { name: tile }).click()
}

async function closeAll(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 })
}

test('Q1 the Add sheet: order, no duplicates of other screens, every way to close it @desktop', async ({ page, user }) => {
  void user
  await goto(page, '/flow')
  await test.step('tiles in frequency order, voice is a tile, payment methods are not', async () => {
    await fab(page).click()
    const buttons = addSheet(page).getByRole('button')
    await expect(buttons).toHaveCount(TILES.length)
    for (const [i, name] of TILES.entries()) await expect(buttons.nth(i)).toHaveAccessibleName(name)
    await expect(addSheet(page)).not.toContainText(/Pay method|bottom bar/)
    await page.waitForTimeout(600)
    await page.screenshot({ path: test.info().outputPath('add-sheet.png') })
  })
  await test.step('Escape closes', async () => { await closeAll(page) })
  await test.step('tapping outside closes', async () => {
    await fab(page).click()
    await expect(addSheet(page)).toBeVisible()
    await page.waitForTimeout(500) // ModalShell ignores backdrop taps for 400ms after opening (ghost-click guard)
    await page.mouse.click(20, 20)
    await expect(addSheet(page)).toBeHidden()
  })
  await test.step('keyboard: focus the + and press Enter', async () => {
    await fab(page).focus()
    await page.keyboard.press('Enter')
    await expect(addSheet(page)).toBeVisible()
    await closeAll(page)
  })
})

test('Q2 Expense and Money in save from the Add sheet', async ({ page, user }) => {
  void user
  await goto(page, '/reports')
  await addExpense(page, { amount: 75, description: 'QA Q coffee', category: 'Food' })
  await localWait(page, (s) => s.expenses.find((e: any) => e.description === 'QA Q coffee' && e.amount === 75))
  await addMoneyIn(page, { amount: 300, name: 'QA Q refund' })
  await localWait(page, (s) => (s.incomeEvents ?? []).find((e: any) => /QA Q refund/.test(e.name ?? e.label ?? e.description ?? '')) ?? null)
})

test('Q3 Savings opens Add money directly on Wealth, once, and saves', async ({ page, user }) => {
  void user
  await test.step('brand-new account: the sheet still opens and offers a way forward', async () => {
    await goto(page, '/settings')
    await openTile(page, /^Savings/)
    await expect(page).toHaveURL(/\/wealth$/)
    await expect(dialog(page, 'Add money')).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: test.info().outputPath('savings-new-user.png') })
    await closeAll(page)
  })
  await test.step('leaving and coming back does not reopen it', async () => {
    await goto(page, '/flow')
    await goto(page, '/wealth')
    await page.waitForTimeout(1000)
    await expect(dialog(page, 'Add money')).toBeHidden()
  })
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 5000 })
  await test.step('with an account: deposit 500 from the + on another screen', async () => {
    await goto(page, '/reports')
    await openTile(page, /^Savings/)
    const d = dialog(page, 'Add money')
    // The first pocket is preselected in the Into field (BDG-026-028 picker).
    await expect(d.getByRole('button', { name: /^Into: / })).toBeVisible()
    await d.getByRole('textbox', { name: 'Amount' }).fill('500')
    await blur(page)
    await d.getByRole('button', { name: /^Add [\d,]+ to / }).click()
    await expect(d).toBeHidden()
    await localWait(page, (s) => (s.savingsTransactions ?? s.savingsDeposits ?? []).find((t: any) => Number(t.amount) === 500) ?? (s.savingsAccounts ?? []).find((a: any) => Number(a.balance ?? a.currentBalance) === 500))
  })
})

test('Q4 Pay debt: empty state leads to adding one; with a debt it pays', async ({ page, user }) => {
  void user
  await goto(page, '/flow')
  await test.step('no debts: a way forward, not a dead end', async () => {
    await openTile(page, /^Pay debt/)
    const picker = childSheet(page)
    await expect(picker).toContainText('No active debts')
    await picker.getByRole('button', { name: 'Add a debt' }).click()
    // The light-touch "Add a debt" option sheet opens over the picker (the same one as on Debts), and its choice leads to the form.
    const add = dialog(page, 'Add a debt')
    await expect(add).toContainText('What are you tracking?')
    for (const family of [/^Borrowed money/, /^Installment plan/, /^Credit card/]) await expect(add.getByRole('radio', { name: family })).toBeVisible()
    await add.getByRole('radio', { name: /^Borrowed money/ }).click()
    await expect(dialog(page, 'New borrow')).toBeVisible()
    await closeAll(page)
  })
  await addBorrow(page, { person: 'QA Sami', what: 'QA loan', amount: 1000 })
  await test.step('with a debt: pick it and pay', async () => {
    await goto(page, '/notifications')
    await openTile(page, /^Pay debt/)
    await childSheet(page).getByRole('button', { name: /QA (Sami|loan)/ }).first().click()
    const pay = dialog(page, 'Make a payment')
    await pay.getByRole('textbox', { name: 'Amount' }).fill('200')
    await blur(page)
    await pay.getByRole('button', { name: /^(Record payment|Pay [\d,]+ EGP)$/ }).click()
    await expect(pay).toBeHidden()
    await localWait(page, (s) => s.debtPayments.find((p: any) => p.amountPaid === 200))
  })
})

test('Q5 Subscription, Receipt and voice work from a page with no add button', async ({ page, user, context }) => {
  void user
  await context.grantPermissions(['microphone', 'camera'])
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 3000 })
  await test.step('Subscription lands on Subscriptions with the add sheet open, and saves', async () => {
    await goto(page, '/budget-history')
    await openTile(page, /^Subscription/)
    await expect(page).toHaveURL(/\/subscriptions$/)
    const picker = childSheet(page)
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: /^Netflix/ }).first().click()
    const d = dialog(page, 'Add Netflix Standard')
    await d.getByRole('group', { name: 'Paid with' }).getByRole('button', { name: 'QNB Alahli' }).click()
    await d.getByRole('button', { name: 'Add Netflix Standard' }).click()
    await expect(d).toBeHidden()
    await localWait(page, (s) => (s.subscriptions ?? []).find((x: any) => /Netflix/.test(x.name ?? '')))
  })
  for (const [tile, shot] of [[/^Receipt/, 'receipt'], [/^Add by voice/, 'voice']] as const) {
    await test.step(`${shot} opens its sheet; Escape cancels before any AI call`, async () => {
      await goto(page, '/reports')
      await openTile(page, tile)
      await expect(addSheet(page)).toBeHidden()
      await expect(childSheet(page)).toBeVisible()
      await page.waitForTimeout(700)
      await page.screenshot({ path: test.info().outputPath(`${shot}-sheet.png`) })
      await closeAll(page)
    })
  }
})

test('Q6 the + is on every screen whose only add action is the + @desktop', async ({ page, user }) => {
  void user
  for (const path of ['/flow', '/reports', '/notifications', '/settings', '/budget-history', '/goals', '/paydays', '/subscriptions', '/accounts', '/wealth', '/debts']) {
    await test.step(path, async () => {
      await goto(page, path)
      await fab(page).click()
      await expect(addSheet(page), path).toBeVisible()
      await closeAll(page)
    })
  }
})
