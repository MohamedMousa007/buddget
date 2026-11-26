/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import { expect, goto, localState, localWait, test, tile, netWorth } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addExpense, shown } from '../lib/ui'

test('B bank account > expense on it > balance > reports', async ({ page, user }) => {
  await test.step('add a QNB bank account with 1,000', async () => {
    await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 1000 })
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText(shown('1,000'))
  })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance != null))
  expect(qnb?.openingBalance).toBe(1000)
  await serverRows('payment_methods', user.id, `id=eq.${qnb.id}`, (r: any[]) => r.length === 1 && Number(r[0].opening_balance) === 1000)

  await test.step('spend 250 on Food from QNB', async () => {
    await goto(page, '/flow')
    await addExpense(page, { amount: 250, description: 'QA B groceries', category: 'Food', method: /QNB/ })
  })
  await test.step('UI: Flow spent 250, net worth 750; Accounts QNB 750', async () => {
    await expect(page.locator('main').getByText(shown('250 EGP')).first()).toBeVisible()
    expect(await netWorth(page)).toBe(750)
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText(shown('750'))
  })
  await test.step('local store: one expense on QNB', async () => {
    const e = await localWait(page, (s) => { const r = s.expenses.filter((x: any) => x.description === 'QA B groceries'); return r.length ? r : null })
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ amount: 250, paymentMethodId: qnb.id, category: 'Food' })
  })
  await test.step('server: expense row on QNB', async () => {
    const r = await serverRows('expenses', user.id, 'description=eq.QA B groceries&deleted_at=is.null', (r) => r.length === 1)
    expect(Number(r[0].amount)).toBe(250)
    expect(r[0].payment_method_id).toBe(qnb.id)
  })
  await test.step('reports agree', async () => {
    await goto(page, '/reports')
    const main = page.locator('main')
    // Light touch Insights: with one purchase it is still learning, and it counts that purchase; the spending area opens Flow.
    await expect(main).toContainText(/\b1 of \d+ purchases/)
    await main.getByText('Your money, area by area', { exact: true }).click()
    await main.getByRole('link', { name: /^Spending/ }).click()
    await expect(page).toHaveURL(/\/flow/)
    await expect(page.locator('main').getByRole('button', { name: /QA B groceries/ })).toContainText(shown('250'))
  })
})
