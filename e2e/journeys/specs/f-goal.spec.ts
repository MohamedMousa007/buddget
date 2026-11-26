/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { expect, goto, localWait, test, tile } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, blur, dialog } from '../lib/ui'

/** Add goal (version C): one page; Fund it opens its own sheet. */
async function startGoal(page: Page, name: string, target: number) {
  await goto(page, '/goals')
  await page.getByRole('button', { name: 'Start from scratch' }).click()
  const d = dialog(page, 'New goal')
  await d.getByRole('button', { name: 'Vacation' }).click()
  await d.getByRole('textbox', { name: 'Goal name' }).fill(name)
  await d.getByRole('textbox', { name: 'Target Amount' }).fill(String(target))
  await blur(page)
  await d.getByRole('button', { name: /^Fund it/ }).click()
  return { d, fundIt: dialog(page, 'Fund it') }
}

async function fund(page: Page, goalName: string, amount: number) {
  await goto(page, '/goals')
  await page.getByRole('button', { name: new RegExp(goalName) }).first().click()
  await page.getByRole('button', { name: 'Add money', exact: true }).click()
  const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
  await expect(d).toContainText('QNB')
  await blur(page)
  await d.getByRole('button', { name: 'Add to goal', exact: true }).click()
  await expect(d).toBeHidden()
}

test('F goal > fund > progress > achieve', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 3000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 3000))

  const goal = await test.step('create goal QA Trip 1,000, funded by me', async () => {
    const { d, fundIt } = await startGoal(page, 'QA Trip', 1000)
    await fundIt.getByRole('radio', { name: /add money myself/ }).click()
    await fundIt.getByRole('button', { name: 'Done' }).click()
    await d.getByRole('button', { name: 'Create goal' }).click()
    await expect(d).toBeHidden()
    const g = await localWait(page, (s) => s.goals.find((x: any) => x.name === 'QA Trip'))
    expect(g.linkedSavingsAccountIds?.length).toBe(1)
    await serverRows('goals', user.id, `id=eq.${g.id}`, (r: any[]) => r.length === 1 && Number(r[0].target_amount) === 1000)
    return g
  })
  const pocketId = goal.linkedSavingsAccountIds[0]

  await test.step('fund 250 from QNB: 25%, QNB 2,750, net worth unchanged', async () => {
    await fund(page, 'QA Trip', 250)
    await expect(page.locator('main')).toContainText('25%')
    await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.id === pocketId && a.currentBalance === 250))
    await serverRows('savings_accounts', user.id, `id=eq.${pocketId}`, (r: any[]) => Number(r[0]?.current_balance) === 250)
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText('2,750.00')
    await goto(page, '/flow')
    expect(await tile(page, 'Net worth')).toBe(3000)
  })

  await test.step('fund the remaining 750: achieved', async () => {
    await fund(page, 'QA Trip', 750)
    await expect(page.locator('main')).toContainText(/100%|achieved|reached|done/i)
    const g = await localWait(page, (s) => s.goals.find((x: any) => x.id === goal.id && x.status === 'achieved'))
    expect(g.achievedAt).toBeTruthy()
    await serverRows('goals', user.id, `id=eq.${goal.id}`, (r: any[]) => r[0]?.status === 'achieved' && !!r[0].achieved_at)
    await serverRows('savings_accounts', user.id, `id=eq.${pocketId}`, (r: any[]) => Number(r[0]?.current_balance) === 1000)
  })
})

/** New goal with money already saved; `home` is the "Where is it?" tab (Account keeps it in the first account, QNB here). */
async function goalWithSaved(page: Page, o: { name: string; saved: number; home: 'Account' | 'Outside'; overFirst?: { amount: number; alert: string } }) {
  const { d, fundIt } = await startGoal(page, o.name, 2000)
  const saved = fundIt.getByRole('textbox', { name: 'Already saved' })
  const where = fundIt.getByRole('radiogroup', { name: 'Where is it?' })
  await where.getByRole('radio', { name: o.home }).click()
  if (o.overFirst) {
    await saved.fill(String(o.overFirst.amount))
    await expect(fundIt.getByRole('alert')).toHaveText(o.overFirst.alert)
  }
  await saved.fill(String(o.saved))
  await expect(fundIt.getByRole('alert')).toHaveCount(0)
  await blur(page)
  await fundIt.getByRole('radio', { name: /add money myself/ }).click()
  await fundIt.getByRole('button', { name: 'Done' }).click()
  await d.getByRole('button', { name: 'Create goal' }).click()
  await expect(d).toBeHidden()
  const g = await localWait(page, (s) => s.goals.find((x: any) => x.name === o.name && x.linkedSavingsAccountIds?.length === 1))
  return g.linkedSavingsAccountIds[0] as string
}

test('F2 goal "Already saved" in a tracked account: set aside there, net worth and the account unchanged; over available refused [Phase 0.7]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 3000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 3000))
  const pocketId = await goalWithSaved(page, {
    name: 'QA Saved In', saved: 400, home: 'Account',
    overFirst: { amount: 3500, alert: 'Only 3,000 EGP is available in QNB Alahli.' },
  })
  await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.id === pocketId && a.heldInPaymentMethodId === qnb.id && a.currentBalance === 400))
  await serverRows('savings_accounts', user.id, `id=eq.${pocketId}`, (r: any[]) => Number(r[0]?.current_balance) === 400 && r[0]?.held_in_payment_method_id === qnb.id)
  await goto(page, '/accounts')
  await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText('3,000.00')
  expect(await tile(page, 'Available now')).toBe(2600)
  await goto(page, '/flow')
  expect(await tile(page, 'Net worth')).toBe(3000)
})

test('F3 goal "Already saved" somewhere else: counted once as new money, accounts untouched [Phase 0.7]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 3000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 3000))
  const pocketId = await goalWithSaved(page, { name: 'QA Saved Out', saved: 400, home: 'Outside' })
  await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.id === pocketId && !a.heldInPaymentMethodId && a.currentBalance === 400))
  await serverRows('savings_accounts', user.id, `id=eq.${pocketId}`, (r: any[]) => Number(r[0]?.current_balance) === 400 && r[0]?.held_in_payment_method_id === null)
  await goto(page, '/accounts')
  await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText('3,000.00')
  expect(await tile(page, 'Available now')).toBe(3000)
  await goto(page, '/flow')
  expect(await tile(page, 'Net worth')).toBe(3400)
})
