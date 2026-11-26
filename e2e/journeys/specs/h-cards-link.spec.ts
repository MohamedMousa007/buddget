/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// QA night bugs 1, 2, 5, 6, 7, 10 (1a8476b6, decisions D1-D6 in docs/plans/QA_NIGHT_PLAN.md): a card added from an account
// is linked to it, a provider switch re-checks the link, the card lands under the right account, and an edited link moves
// the card (a debit card with spending asks first and its spending follows it).
import type { Locator, Page } from '@playwright/test'
import { expect, goto, localWait, test } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addExpense, blur, dialog, openAccount } from '../lib/ui'

/** Light touch card sheet: "Bank or wallet" provider row, "Uses <account>" link row (No account when standalone). */
const cardSheet = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^Uses / }) }).last()
const linkedField = (sheet: Locator) => sheet.getByRole('button', { name: /^Uses / })

async function switchProvider(page: Page, sheet: Locator, search: string, next: RegExp) {
  await sheet.getByRole('button', { name: /^Bank or wallet/ }).click()
  const pick = dialog(page, 'Choose provider')
  await pick.getByRole('textbox').first().fill(search)
  await pick.getByRole('radio', { name: next }).first().click()
  await expect(pick).toBeHidden()
}

const balanceOf = async (page: Page, name: RegExp) => {
  await goto(page, '/accounts')
  const t = await page.getByRole('button', { name }).first().textContent()
  return Number((t ?? '').match(/(-?[\d,]+(?:\.\d+)?) EGP/)?.[1].replace(/,/g, ''))
}

test('H1 card added from an account: linked to it, provider switch re-links, lands under the right account; edit moves it', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 5000 })
  await addAccount(page, { kind: 'Bank', provider: /^CIB/, balance: 3000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))
  const cib = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'CIB' && m.openingBalance === 3000))

  await test.step('the bank page offers an "Add a card" tile while it has no card; it opens Add a card for that bank', async () => {
    await goto(page, '/accounts')
    await page.getByRole('button', { name: /^QNB Alahli/ }).first().click()
    await expect(page.locator('main')).toContainText('Total here')
    await page.locator('main').getByRole('button', { name: 'Add a card' }).click()
    const sheet = cardSheet(page)
    await expect(sheet.getByRole('button', { name: /^Bank or wallet/ })).toContainText('QNB Alahli')
    await expect(linkedField(sheet)).toContainText('QNB Alahli')
    await sheet.getByRole('button', { name: 'Close' }).first().click()
    await expect(sheet).toBeHidden()
  })

  const card = await test.step('Add a card from QNB: linked to QNB; CIB re-links to CIB; Banque Misr (no account) to None', async () => {
    const detail = await openAccount(page, /QNB Alahli/)
    await detail.getByRole('button', { name: 'Add a card' }).click()
    const sheet = cardSheet(page)
    await expect(linkedField(sheet)).toContainText('QNB Alahli')
    await switchProvider(page, sheet, 'Banque Misr', /^Banque Misr/)
    await expect(linkedField(sheet)).toContainText('No account')
    await switchProvider(page, sheet, 'CIB', /^CIB/)
    await expect(linkedField(sheet)).toContainText('CIB')
    await sheet.getByRole('textbox', { name: 'Last 4 digits' }).fill('4321')
    await blur(page)
    await sheet.getByRole('button', { name: 'Add card', exact: true }).click()
    await expect(sheet).toBeHidden()
    const c = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.type === 'debit_card' && m.parentId === cib.id && m.last4 === '4321'))
    await serverRows('payment_methods', user.id, `id=eq.${c.id}`, (r: any[]) => r[0]?.parent_id === cib.id && r[0]?.type === 'debit_card')
    return c
  })

  await test.step('the card sits in CIB, not in QNB', async () => {
    // Light touch: an account sheet lists its cards as rows named "<account> <last 4>".
    const cibSheet = await openAccount(page, /^CIB/)
    await expect(cibSheet.getByRole('button', { name: 'CIB 4321' })).toBeVisible()
    await page.keyboard.press('Escape')
    const qnbSheet = await openAccount(page, /QNB Alahli/)
    await expect(qnbSheet.getByRole('button', { name: 'Add a card' })).toBeVisible()
    await expect(qnbSheet.getByRole('button', { name: /4321$/ })).toHaveCount(0)
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
    await cibSheet.getByRole('button', { name: 'CIB 4321' }).click()
    // The card row opens the card's own sheet; Edit sits in its More actions menu.
    const cardView = page.getByRole('dialog').filter({ hasText: '••4321' }).last()
    await cardView.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const sheet = cardSheet(page)
    await expect(linkedField(sheet)).toContainText('CIB')
    await linkedField(sheet).click()
    await dialog(page, /^Uses$/).getByRole('radio', { name: /^QNB Alahli/ }).click()
    await expect(linkedField(sheet)).toContainText('QNB Alahli')
    await blur(page)
    await sheet.getByRole('button', { name: /^Save( changes| method| card)?$/ }).click()
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
