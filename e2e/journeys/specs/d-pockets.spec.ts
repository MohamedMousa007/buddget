/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { expect, goto, localWait, test, tile } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addBorrow, blur, dialog } from '../lib/ui'

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
    await d.getByRole('radio', { name: /QA Pocket/ }).click()
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
    const from = d.getByRole('radio', { name: /QA Pocket/ })
    if (await from.count()) await from.click()
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
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.linkedPaymentMethodId || a.heldInPaymentMethodId))
  await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r) => r.length === 1)
  test.info().annotations.push({ type: 'evidence', description: `pocket ${pocket.id} linkedPaymentMethodId=${pocket.linkedPaymentMethodId} heldIn=${pocket.heldInPaymentMethodId ?? 'none'} balance=${pocket.currentBalance}` })
  expect(await qnbBalance(page)).toBe(5000)
  expect(await netWorthFlow(page)).toBe(5000)
})

test('D3 money leaving a pocket held in an account moves the account [S-2]', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  await newPocket(page, { kind: /^QNB Alahli/, amount: 500 })
  const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.heldInPaymentMethodId))
  expect(await netWorthFlow(page)).toBe(5000)

  const withdraw = async (purpose: string, amount: number, cta: RegExp) => {
    await goto(page, '/wealth')
    await page.getByRole('button', { name: 'Withdraw' }).first().click()
    const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
    const from = d.getByRole('radio', { name: new RegExp(pocket.name) })
    if (await from.count()) await from.click()
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
  })
})
