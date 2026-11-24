/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { expect, goto, localWait, test, tile } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addBorrow, blur, dialog, pickPocket } from '../lib/ui'

const netWorthFlow = async (page: Page) => { await goto(page, '/flow'); return tile(page, 'Net worth') }
const qnbBalance = async (page: Page) => {
  await goto(page, '/accounts')
  const t = await page.getByRole('button', { name: /QNB Alahli/ }).first().textContent()
  return Number((t ?? '').match(/[\d,]+\.\d\d/)?.[0].replace(/,/g, ''))
}

async function newPocket(page: Page, o: { kind: RegExp; name?: string; amount: number }) {
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add pocket or asset' }).click()
  const add = dialog(page, 'Add to Wealth')
  await add.getByRole('radio', { name: o.kind }).click()
  await add.getByRole('button', { name: 'Continue' }).click()
  const form = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Create pocket' }) })
  if (o.name) await form.getByRole('textbox').first().fill(o.name)
  await form.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await blur(page)
  await form.getByRole('button', { name: 'Create pocket' }).click()
  await expect(form).toBeHidden()
}

test('D savings pocket allocate > withdraw > balances > net worth', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  expect(await netWorthFlow(page)).toBe(5000)

  const pocket = await test.step('create an empty cash pocket', async () => {
    await newPocket(page, { kind: /^Cash At home/, name: 'QA Pocket', amount: 0 })
    return localWait(page, (s) => s.savingsAccounts.find((a: any) => a.name === 'QA Pocket'))
  })

  await test.step('allocate 1,000 from QNB: QNB 4,000, pocket 1,000, net worth unchanged', async () => {
    await goto(page, '/wealth')
    await page.getByRole('button', { name: 'Add money' }).first().click()
    const d = dialog(page, 'Add money')
    await pickPocket(page, d, 'Into', /QA Pocket/)
    await d.getByRole('textbox', { name: 'Amount' }).fill('1000')
    await expect(d.getByRole('button', { name: /From account QNB Alahli/ })).toBeVisible()
    await blur(page)
    await d.getByRole('button', { name: /^Add [\d,]+ to QA Pocket/ }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('button', { name: /QA Pocket/ }).first()).toContainText('1,000')
    expect(await qnbBalance(page)).toBe(4000)
    expect(await netWorthFlow(page)).toBe(5000)
    const tx = await localWait(page, (s) => s.savingsTransactions.find((t: any) => t.accountId === pocket.id && t.amount === 1000))
    expect(tx.paymentMethodId).toBe(qnb.id)
    await serverRows('savings_transactions', user.id, `id=eq.${tx.id}`, (r: any[]) => r.length === 1 && r[0].payment_method_id === qnb.id && Number(r[0].amount) === 1000)
    await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 1000)
  })

  await test.step('withdraw 300 back to QNB: QNB 4,300, pocket 700, net worth unchanged', async () => {
    await goto(page, '/wealth')
    await page.getByRole('button', { name: 'Withdraw' }).first().click()
    const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
    await pickPocket(page, d, 'From', /QA Pocket/)
    await d.getByRole('textbox', { name: 'Amount' }).fill('300')
    // 'Income: back into this month' is the purpose that returns money to an account (AccountLegRow 'to account').
    await d.getByRole('radio').filter({ hasText: 'Back into this month' }).click()
    await expect(d).toContainText('QNB')
    await blur(page)
    await d.getByRole('button', { name: /300 .*QA Pocket/ }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('button', { name: /QA Pocket/ }).first()).toContainText('700')
    expect(await qnbBalance(page)).toBe(4300)
    expect(await netWorthFlow(page)).toBe(5000)
    await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 700)
  })
})

test('D2 pocket created from an account you already have keeps net worth [QA-013]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  expect(await netWorthFlow(page)).toBe(5000)
  await newPocket(page, { kind: /^QNB Alahli/, amount: 500 })
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => (a.linkedPaymentMethodId || a.heldInPaymentMethodId) && a.currentBalance === 500))
  await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r) => r.length === 1)
  test.info().annotations.push({ type: 'evidence', description: `pocket ${pocket.id} linkedPaymentMethodId=${pocket.linkedPaymentMethodId} heldIn=${pocket.heldInPaymentMethodId ?? 'none'} balance=${pocket.currentBalance}` })
  expect(await qnbBalance(page)).toBe(5000)
  expect(await netWorthFlow(page)).toBe(5000)
})

test('D3 money leaving a pocket held in an account moves the account [S-2]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  await newPocket(page, { kind: /^QNB Alahli/, name: 'QA Held Pocket', amount: 500 })
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.heldInPaymentMethodId && a.currentBalance === 500))
  expect(await netWorthFlow(page)).toBe(5000)

  const withdraw = async (purpose: string, amount: number, cta: RegExp) => {
    await goto(page, '/wealth')
    await page.getByRole('button', { name: 'Withdraw' }).first().click()
    const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
    // The app-seeded Monthly Savings vault is listed too: pick the test's pocket by its own name (pickPocket checks the pick took).
    await pickPocket(page, d, 'From', /QA Held Pocket/)
    await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
    await d.getByRole('radio').filter({ hasText: purpose }).click()
    return { d, cta }
  }

  await test.step('Spending 200: net worth and the account drop by 200, free stays', async () => {
    const { d, cta } = await withdraw('Spending', 200, /Spend 200 from/)
    await blur(page)
    await d.getByRole('button', { name: cta }).click()
    await expect(d).toBeHidden()
    expect(await qnbBalance(page)).toBe(4800)
    expect(await netWorthFlow(page)).toBe(4800)
    await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.id === pocket.id && a.currentBalance === 300))
    await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 300)
  })

  await test.step('Pay a debt 100 from the pocket: net worth unchanged, the account drops by 100', async () => {
    await addBorrow(page, { person: 'Ahmed', what: 'QA D loan', amount: 1000 })
    const before = await netWorthFlow(page)
    const accountBefore = await qnbBalance(page)
    const { d } = await withdraw('Pay a debt', 100, /Pay 100 from/)
    await d.getByRole('button', { name: 'Pick a debt' }).click()
    await d.getByRole('radio', { name: /QA D loan/ }).click()
    await blur(page)
    await d.getByRole('button', { name: /Pay 100 from/ }).click()
    await expect(d).toBeHidden()
    expect(await qnbBalance(page)).toBe(accountBefore - 100)
    expect(await netWorthFlow(page)).toBe(before)
    await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 200)
  })
})

test('D4 Add pocket from Add money keeps the amount and selects the new pocket [BDG-026]', async ({ page, user }) => {
  void user
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add money' }).first().click()
  const d = dialog(page, 'Add money')
  await d.getByRole('textbox', { name: 'Amount' }).fill('250')
  await blur(page)
  await d.getByRole('button', { name: /^Into/ }).click()
  const picker = dialog(page, 'Choose a pocket')
  await picker.getByRole('button', { name: 'Add pocket' }).click()
  await expect(picker).toBeHidden()
  const add = dialog(page, 'Add to Wealth')
  await add.getByRole('radio', { name: /^Cash At home/ }).click()
  await add.getByRole('button', { name: 'Continue' }).click()
  const form = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Create pocket' }) })
  await form.getByRole('textbox').first().fill('QA New Pocket')
  await blur(page)
  await form.getByRole('button', { name: 'Create pocket' }).click()
  await expect(form).toBeHidden()
  await expect(add).toBeHidden()
  await expect(d.getByRole('button', { name: /^Into: QA New Pocket/ })).toBeVisible()
  await expect(d.getByRole('textbox', { name: 'Amount' })).toHaveValue(/250/)
  await d.getByRole('button', { name: /^Add [\d,]+ to QA New Pocket/ }).click()
  await expect(d).toBeHidden()
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.name === 'QA New Pocket'))
  await localWait(page, (s) => s.savingsTransactions.find((t: any) => t.accountId === pocket.id && Number(t.amount) === 250))
})

const availableNow = async (page: Page) => { await goto(page, '/accounts'); return tile(page, 'Available now') }

test('D5 reserve cap: setting aside more than the account has free is refused with the amount, up to free is allowed [Phase 0.2]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  await newPocket(page, { kind: /^QNB Alahli/, name: 'QA Cap Pocket', amount: 500 })
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.name === 'QA Cap Pocket' && a.heldInPaymentMethodId && a.currentBalance === 500))
  expect(await availableNow(page)).toBe(4500)

  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add money' }).first().click()
  const d = dialog(page, 'Add money')
  await pickPocket(page, d, 'Into', /QA Cap Pocket/)
  await d.getByRole('textbox', { name: 'Amount' }).fill('4501')
  await blur(page)
  await expect(d.getByRole('alert')).toHaveText('Only 4,500.00 EGP is available in QNB Alahli.')
  await expect(d.getByRole('button', { name: /^Add [\d,]+ to QA Cap Pocket/ })).toBeDisabled()

  await d.getByRole('textbox', { name: 'Amount' }).fill('4500')
  await blur(page)
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: /^Add [\d,]+ to QA Cap Pocket/ }).click()
  await expect(d).toBeHidden()
  await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 5000)
  expect(await qnbBalance(page)).toBe(5000)
  expect(await availableNow(page)).toBe(0)
  expect(await netWorthFlow(page)).toBe(5000)
})

test('D6 release at zero available: taking money back from a pocket that holds all of the account is allowed [R8]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  await newPocket(page, { kind: /^QNB Alahli/, name: 'QA Full Pocket', amount: 5000 })
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.name === 'QA Full Pocket' && a.heldInPaymentMethodId && a.currentBalance === 5000))
  expect(await availableNow(page)).toBe(0)

  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Withdraw' }).first().click()
  const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
  await pickPocket(page, d, 'From', /QA Full Pocket/)
  await d.getByRole('textbox', { name: 'Amount' }).fill('1000')
  await d.getByRole('radio').filter({ hasText: 'Back into this month' }).click()
  await blur(page)
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: /1,000 .*QA Full Pocket/ }).click()
  await expect(d).toBeHidden()
  await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 4000)
  expect(await qnbBalance(page)).toBe(5000)
  expect(await availableNow(page)).toBe(1000)
  expect(await netWorthFlow(page)).toBe(5000)
})
