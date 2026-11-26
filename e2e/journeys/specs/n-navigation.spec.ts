/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { appNav, expect, goto, localWait, signIn, test, tile, netWorth } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addExpense, dialog, shown } from '../lib/ui'

const ERROR_TEXT = /Something went wrong|Application error|Unhandled Runtime Error|This page could not be found/i

async function healthy(page: Page) {
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(ERROR_TEXT)
}

test('N1 navigation: every main tab, header Budget, profile menu pages @desktop', async ({ page, user }) => {
  void user
  const nav = appNav(page)
  for (const [name, path, heading] of [
    ['Accounts', '/accounts', 'Accounts'],
    ['Wealth', '/wealth', 'Wealth'],
    ['Debts', '/debts', 'Debts'],
    ['Flow', '/flow', 'Flow'],
  ] as const) {
    await test.step(`tab ${name}`, async () => {
      await nav.getByRole('link', { name, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await healthy(page)
    })
  }
  await test.step('header Budget', async () => {
    await page.getByRole('button', { name: 'Budget', exact: true }).or(page.getByRole('link', { name: 'Budget', exact: true })).first().click()
    await expect(page).toHaveURL(/budget-setup/)
    await healthy(page)
  })
  await test.step('profile menu has no Cards item (cards live in Accounts)', async () => {
    await goto(page, '/flow')
    await page.getByRole('button', { name: /^Profile menu/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Goals', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Cards', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
  })
  for (const [item, path] of [
    ['Goals', /\/goals$/], ['Paydays', /\/paydays$/], ['Subscriptions', /\/subscriptions$/], ['Insights', /\/reports$/], ['Settings', /\/settings/]
  ] as const) {
    await test.step(`profile menu > ${item}`, async () => {
      await goto(page, '/flow')
      await page.getByRole('button', { name: /^Profile menu/ }).click()
      await page.getByRole('menuitem', { name: item, exact: true }).click()
      await expect(page).toHaveURL(path)
      await healthy(page)
    })
  }
})

test('N2 global + opens every entry from every main tab @desktop', async ({ page, user }) => {
  void user
  const entries: [RegExp, string | RegExp][] = [
    [/^Money in/, 'Log money in'],
    [/^Expense/, 'Add expense'],
    [/^Pay debt/, /debt|payment/i],
    [/^Subscription/, /subscription/i],
    [/^Savings/, 'Add money'],
  ]
  for (const tab of ['/flow', '/accounts', '/wealth', '/debts']) {
    await test.step(`from ${tab}`, async () => {
      await goto(page, tab)
      for (const [entry, sheet] of entries) {
        await page.getByRole('button', { name: 'Quick add' }).click()
        await dialog(page, 'Add').getByRole('button', { name: entry }).click()
        const d = page.getByRole('dialog').filter({ hasNot: page.getByRole('heading', { name: 'Add', exact: true }) }).last()
        await expect(d, `${tab} + ${entry}`).toBeVisible()
        if (typeof sheet === 'string') await expect(page.getByRole('dialog', { name: sheet })).toBeVisible()
        else await expect(d).toContainText(sheet)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 })
        await healthy(page)
      }
    })
  }
})

test('N3 data survives reload and sign-out/sign-in @desktop', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 2000 })
  await goto(page, '/flow')
  await addExpense(page, { amount: 120, description: 'QA N persist', category: 'Transport', method: /QNB/ })
  const e = await localWait(page, (s) => s.expenses.find((x: any) => x.description === 'QA N persist'))
  await serverRows('expenses', user.id, `id=eq.${e.id}`, (r) => r.length === 1)
  const nw = await netWorth(page)
  expect(nw).toBe(1880)

  await test.step('reload', async () => {
    await goto(page, '/flow')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toContainText('QA N persist')
    expect(await netWorth(page)).toBe(nw)
  })
  await test.step('sign out clears the device copy', async () => {
    // The profile menu redesign (b69d8b3a) moved Sign out to the foot of Settings.
    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Sign out', exact: true }).first().click()
    const confirm = page.getByRole('button', { name: /^Sign out$/ }).last()
    if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click()
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible({ timeout: 30_000 })
    // The sign-in screen shows at once; the final flush then runs before the wipe (AuthProvider.signOut), so wait for it.
    await expect.poll(() => page.evaluate(() => (localStorage.getItem('buddget-storage') ?? '').includes('QA N persist')), {
      message: 'signed-out device still holds the expense in localStorage', timeout: 15_000,
    }).toBe(false)
  })
  await test.step('sign back in: the server copy comes back', async () => {
    await signIn(page, user.email)
    await goto(page, '/flow')
    await expect(page.locator('main')).toContainText('QA N persist', { timeout: 30_000 })
    expect(await netWorth(page)).toBe(nw)
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText(shown('1,880'))
  })
})
