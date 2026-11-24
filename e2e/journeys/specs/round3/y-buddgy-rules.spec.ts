/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// Round 3, J9: Buddgy follows the pocket and goal rules through the real model route (/api/buddgy/turn, GEMINI_API_KEY).
// A goal with money already saved needs `saved_in`; saying the money sits in an account that holds less is refused (no
// proposal sets aside more than the account has free); a smaller amount is set aside in that account: the pocket is
// held there, the account balance and net worth do not move. The model's wording varies, so only the proposal card and
// the store and server rows are asserted.
import { expect, goto, localState, localWait, test } from '../../lib/fixtures'
import { serverRows } from '../../lib/server'
import { dialog } from '../../lib/ui'
import { bank, localMethod, seed } from './seed'

test('J9 Buddgy refuses to set aside more than an account has free and sets a smaller saved amount aside in it', async ({ page, user }) => {
  test.setTimeout(300_000)
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 5000)])
  await localMethod(page, qnb.id)
  await goto(page, '/flow')
  await page.getByRole('button', { name: 'Ask Buddgy' }).click()
  const chat = dialog(page, 'Buddgy')
  const log = chat.getByRole('log')
  const send = async (text: string) => {
    await chat.getByRole('textbox', { name: 'Ask or tell Buddgy…' }).fill(text)
    await chat.getByRole('button', { name: 'Send' }).click()
    await expect(chat.getByRole('textbox', { name: 'Ask or tell Buddgy…' })).toBeEditable({ timeout: 90_000 })
    await page.waitForTimeout(1500)
  }

  await test.step('8,000 already saved "in my QNB account" (which holds 5,000): no proposal sets it aside there', async () => {
    await send('Create a savings goal called QA Car with a target of 20000 EGP. I already saved 8000 EGP for it and that money is in my QNB Alahli account.')
    await expect(log).not.toHaveText(/Set aside in QNB Alahli[\s\S]*8,000|8,000[\s\S]*Set aside in QNB Alahli/)
    await expect(log).not.toContainText('Somewhere else (not tracked here)')
    expect(((await localState(page)).goals as any[]).filter((g) => g.name === 'QA Car')).toHaveLength(0)
  })

  await test.step('3,000 of it in QNB instead: the proposal sets it aside in QNB; approved, the pocket is held there', async () => {
    await send('OK, make the already saved amount 3000 EGP instead, and it is in my QNB Alahli account. Create the goal.')
    const card = log.getByText('Set aside in QNB Alahli').last()
    await expect(card).toBeVisible({ timeout: 60_000 })
    await expect(log).not.toContainText('Somewhere else (not tracked here)')
    await log.getByRole('button', { name: /^(Looks good|Add goal|Create goal|Start goal|Save goal|Add)/ }).last().click()
    const goal = await localWait(page, (s) => s.goals.find((g: any) => g.name === 'QA Car'), 30_000)
    const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => goal.linkedSavingsAccountIds.includes(a.id) && a.currentBalance === 3000))
    expect(pocket.heldInPaymentMethodId).toBe(qnb.id)
    await serverRows('savings_accounts', user.id, `id=eq.${pocket.id}`, (r: any[]) => Number(r[0]?.current_balance) === 3000)
  })

  await test.step('QNB still shows its 5,000 balance (the money was already there)', async () => {
    await chat.getByRole('button', { name: 'Close chat' }).click()
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText('5,000.00')
  })
})
