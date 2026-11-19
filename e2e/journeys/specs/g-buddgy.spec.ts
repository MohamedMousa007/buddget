/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import { expect, goto, localWait, test, tile } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, dialog } from '../lib/ui'

/**
 * Buddgy's model route (/api/buddgy/turn) answers 502 on this dev server (upstream model call fails, E2E-ENV-02), so this
 * journey drives Buddgy's on-device quick-add path, which uses the same proposal/approve/undo machinery. With no income
 * on the account nothing is auto-applied, so the request needs an explicit approval.
 */
test('G Buddgy request > approve > verify > undo', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 1000 })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 1000))
  await goto(page, '/flow')
  const before = await tile(page, 'Net worth')

  // The floating Buddgy button is labelled with the i18n key fabAskAi = "Set up your budget" (E2E-004).
  await page.getByRole('button', { name: 'Set up your budget' }).click()
  const chat = dialog(page, 'Buddgy')
  await chat.getByRole('textbox', { name: 'Ask or tell Buddgy…' }).fill('coffee 45')
  await chat.getByRole('button', { name: 'Send' }).click()

  const log = chat.getByRole('log')
  await test.step('a proposal card asks for approval (nothing written yet)', async () => {
    const approve = log.getByRole('button', { name: /^Looks good/ }).first()
    await expect(approve).toBeVisible({ timeout: 30_000 })
    const st = await localWait(page, (s) => s)
    expect(st.expenses.filter((e: any) => /coffee/i.test(e.description))).toHaveLength(0)
    await approve.click()
  })
  const exp = await test.step('approved: expense 45 in store, server and Flow', async () => {
    await expect(log.getByRole('button', { name: 'Undo' })).toBeVisible()
    const e = await localWait(page, (s) => s.expenses.find((e: any) => /coffee/i.test(e.description) && e.amount === 45))
    await serverRows('expenses', user.id, `id=eq.${e.id}&deleted_at=is.null`, (r) => r.length === 1)
    return e
  })
  await test.step('undo: gone from store and soft-deleted on the server', async () => {
    await log.getByRole('button', { name: 'Undo' }).click()
    await localWait(page, (s) => !s.expenses.some((x: any) => x.id === exp.id && !x.deletedAt))
    await serverRows('expenses', user.id, `id=eq.${exp.id}`, (r: any[]) => r.length === 0 || !!r[0].deleted_at)
    await chat.getByRole('button', { name: 'Close chat' }).click()
    await goto(page, '/flow')
    expect(await tile(page, 'Net worth')).toBe(before)
  })
})
