/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// QA night bugs 1, 2, 5, 6, 7, 10 (1a8476b6, decisions D1-D6 in docs/plans/QA_NIGHT_PLAN.md): a card added from an account
// is linked to it, a provider switch re-checks the link, the card lands under the right account, and an edited link moves
// the card (a debit card with spending asks first and its spending follows it).
import type { Locator, Page } from '@playwright/test'
import { expect, goto, localWait, test } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addExpense, blur, dialog } from '../lib/ui'

const cardSheet = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Save method' }) }).last()
const linkedField = (sheet: Locator) => sheet.getByRole('button', { name: /^Linked account/ })

async function openAccount(page: Page, name: RegExp) {
  await goto(page, '/accounts')
  await page.getByRole('button', { name }).first().click()
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Update' }) }).last()
}

async function switchProvider(page: Page, sheet: Locator, current: RegExp, next: RegExp) {
  await sheet.getByRole('button', { name: current }).filter({ hasNotText: 'Linked account' }).first().click()
  const pick = dialog(page, 'Choose provider')
  await pick.getByRole('radio', { name: next }).first().click()
  await expect(pick).toBeHidden()
}

const balanceOf = async (page: Page, name: RegExp) => {
  await goto(page, '/accounts')
  const t = await page.getByRole('button', { name }).first().textContent()
  return Number((t ?? '').match(/[\d,]+\.\d\d/)?.[0].replace(/,/g, ''))
}

test('H1 card added from an account: linked to it, provider switch re-links, lands under the right account; edit moves it', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await addAccount(page, { kind: 'Bank', provider: /^CIB/, balance: 3000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  const cib = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'CIB' && m.openingBalance === 3000))

  const card = await test.step('Add a card from QNB: linked to QNB; CIB re-links to CIB; Banque Misr (no account) to None', async () => {
    const detail = await openAccount(page, /QNB Alahli/)
    await detail.getByRole('button', { name: 'Add a card' }).click()
    const sheet = cardSheet(page)
    await expect(linkedField(sheet)).toContainText('QNB Alahli')
    await switchProvider(page, sheet, /QNB Alahli/, /^Banque Misr/)
    await expect(linkedField(sheet)).toContainText('None (standalone)')
    await switchProvider(page, sheet, /Banque Misr/, /^CIB/)
    await expect(linkedField(sheet)).toContainText('CIB')
    await sheet.getByRole('textbox', { name: 'Last digits' }).fill('4321')
    await blur(page)
    await sheet.getByRole('button', { name: 'Save method' }).click()
    await expect(sheet).toBeHidden()
    const c = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.type === 'debit_card' && m.parentId === cib.id && m.last4 === '4321'))
    await serverRows('payment_methods', user.id, `id=eq.${c.id}`, (r: any[]) => r[0]?.parent_id === cib.id && r[0]?.type === 'debit_card')
    return c
  })

  await test.step('the card sits in CIB, not in QNB', async () => {
    const cibSheet = await openAccount(page, /^CIB/)
    await expect(cibSheet.getByRole('button', { name: 'Manage' })).toBeVisible()
    await page.keyboard.press('Escape')
    const qnbSheet = await openAccount(page, /QNB Alahli/)
    await expect(qnbSheet.getByRole('button', { name: 'Add a card' })).toBeVisible()
    await expect(qnbSheet.getByRole('button', { name: 'Manage' })).toHaveCount(0)
  })

  await test.step('spend 200 on the card: CIB drops, QNB does not', async () => {
    await goto(page, '/flow')
    await addExpense(page, { amount: 200, description: 'QA H1 lunch', category: 'Food', method: /CIB •• 4321/ })
    await localWait(page, (s) => s.expenses.find((e: any) => e.description === 'QA H1 lunch' && e.paymentMethodId === card.id))
    expect(await balanceOf(page, /^CIB/)).toBe(2800)
    expect(await balanceOf(page, /QNB Alahli/)).toBe(5000)
  })

  await test.step('edit the link to QNB: a used debit card asks first, then its spending follows it', async () => {
    const cibSheet = await openAccount(page, /^CIB/)
    await cibSheet.getByRole('button', { name: 'Manage' }).first().click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const sheet = cardSheet(page)
    await expect(linkedField(sheet)).toContainText('CIB')
    await linkedField(sheet).click()
    await sheet.getByRole('option', { name: /QNB Alahli/ }).click()
    await expect(linkedField(sheet)).toContainText('QNB Alahli')
    await blur(page)
    await sheet.getByRole('button', { name: 'Save method' }).click()
    const ask = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: 'Move this card?' })).last()
    await expect(ask).toContainText('Move this card?')
    await expect(ask).toContainText('QNB Alahli')
    await ask.getByRole('button', { name: 'Move card' }).click()
    await expect(sheet).toBeHidden()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === card.id && m.parentId === qnb.id))
    await serverRows('payment_methods', user.id, `id=eq.${card.id}`, (r: any[]) => r[0]?.parent_id === qnb.id)
    expect(await balanceOf(page, /QNB Alahli/)).toBe(4800)
    expect(await balanceOf(page, /^CIB/)).toBe(3000)
  })
})
