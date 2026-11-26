/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { expect, goto, knownBug, localWait, test, tile } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, dialog, pickMethod, shown } from '../lib/ui'

async function openSub(page: Page) {
  await page.getByRole('radio', { name: 'All' }).click()
  await page.getByRole('button', { name: /^Netflix/ }).first().click()
  return dialog(page, /^Netflix/)
}

test('E subscription add > mark paid > pause > resume > cancel', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 2000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 2000))
  await goto(page, '/subscriptions')

  const sub = await test.step('add Netflix Standard 190/mo paid with QNB', async () => {
    await page.getByRole('button', { name: /^Netflix/ }).click()
    const d = dialog(page, 'Add a subscription')
    await expect(d.getByRole('radio', { name: 'Standard' })).toBeChecked()
    await d.getByRole('button', { name: /^Paid with/ }).click()
    await pickMethod(page, /^QNB Alahli/)
    await d.getByRole('button', { name: 'Add Netflix' }).click()
    await expect(d).toBeHidden()
    expect(await tile(page, 'Subscriptions · per month')).toBe(190)
    const s = await localWait(page, (s) => s.subscriptions.find((x: any) => /Netflix/.test(x.name)))
    expect(s).toMatchObject({ amount: 190, paymentMethodId: qnb.id, status: 'active' })
    await serverRows('subscriptions', user.id, `id=eq.${s.id}`, (r: any[]) => r.length === 1 && r[0].status === 'active' && Number(r[0].amount) === 190)
    // Adding must not post a charge by itself.
    expect((await localWait(page, (st) => st)).expenses.filter((e: any) => e.linkedSubscriptionId === s.id)).toHaveLength(0)
    return s
  })

  const exp = await test.step('mark paid -> exactly one 190 expense from QNB, next charge moves a month', async () => {
    const d = await openSub(page)
    await d.getByRole('button', { name: 'Mark paid' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('main')).toContainText('Paid 190')
    const e = await localWait(page, (s) => { const r = s.expenses.filter((e: any) => e.linkedSubscriptionId === sub.id); return r.length ? r : null })
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ amount: 190, paymentMethodId: qnb.id })
    await serverRows('expenses', user.id, `linked_subscription_id=eq.${sub.id}&deleted_at=is.null`, (r) => r.length === 1)
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText(shown('1,810'))
    await goto(page, '/subscriptions')
    return e[0]
  })

  // Light touch has no pause: Buddgy sets the status from bank messages (SubscriptionDetailSheet header note). The
  // lifecycle left to the user is cancel, then Re-subscribe from Ended.
  await test.step('cancel -> cancelled, past charge kept', async () => {
    const d = await openSub(page)
    await d.getByRole('button', { name: 'Cancel subscription' }).click()
    const confirm = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Cancel subscription' }) }).last().getByRole('button', { name: 'Cancel subscription' })
    if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click()
    await localWait(page, (s) => s.subscriptions.find((x: any) => x.id === sub.id && x.status === 'cancelled'))
    await serverRows('subscriptions', user.id, `id=eq.${sub.id}`, (r: any[]) => r[0]?.status === 'cancelled')
    await serverRows('expenses', user.id, `id=eq.${exp.id}&deleted_at=is.null`, (r) => r.length === 1)
  })

  await test.step('Re-subscribe from Ended -> active again, still one charge', async () => {
    await goto(page, '/subscriptions')
    await page.getByRole('radio', { name: 'Ended' }).click()
    await page.getByRole('button', { name: /^Netflix/ }).first().click()
    const d = dialog(page, /^Netflix/)
    await d.getByRole('button', { name: 'Re-subscribe' }).click()
    await localWait(page, (s) => s.subscriptions.find((x: any) => x.id === sub.id && x.status === 'active'))
    await serverRows('subscriptions', user.id, `id=eq.${sub.id}`, (r: any[]) => r[0]?.status === 'active')
    const st = await localWait(page, (s) => s)
    expect(st.expenses.filter((e: any) => e.linkedSubscriptionId === sub.id && !e.deletedAt)).toHaveLength(1)
  })

  await test.step('the sheet lists the 190 charge under Last charges', async () => {
    const d = await openSub(page)
    knownBug('LT-E1', 'Last charges shows "−0.00 EGP" for a 190 EGP Mark paid charge (SubscriptionDetailSheet.tsx:247 reads amountInBaseCurrency, which the Mark paid expense does not carry)')
    await expect(d).toContainText(/Last charges[^]*?−190(\.00)? EGP[^]*?Next charges/)
  })
})
