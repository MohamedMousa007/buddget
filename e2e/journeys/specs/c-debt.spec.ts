/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { expect, goto, knownBug, localWait, test, tile } from '../lib/fixtures'
import { serverNow, serverRows } from '../lib/server'
import { addAccount, addBorrow, payDebt } from '../lib/ui'

const stillOwed = (page: Page) => tile(page, 'Still owed')

async function setupDebt(page: Page, userId: string) {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  await addBorrow(page, { person: 'Ahmed', what: 'QA C loan', amount: 3000 })
  await expect.poll(() => stillOwed(page)).toBe(3000)
  const debt = await localWait(page, (s) => s.debts.find((d: any) => d.name === 'QA C loan'))
  await serverRows('debts', userId, `id=eq.${debt.id}`, (r) => r.length === 1)
  return debt
}

test('C1 debt > pay from a bank account > remaining debt > reports', async ({ page, user }) => {
  const debt = await setupDebt(page, user.id)
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli'))

  await test.step('pay 700 from QNB', async () => payDebt(page, { debt: 'QA C loan', amount: 700, method: 'QNB Alahli' }))
  await test.step('UI: still owed 2,300', async () => expect.poll(() => stillOwed(page)).toBe(2300))
  const pay = await test.step('local: payment + linked expense on QNB', async () => {
    const p = await localWait(page, (s) => s.debtPayments.find((x: any) => x.debtId === debt.id && x.amountPaid === 700))
    expect(p.paymentMethodId).toBe(qnb.id)
    const e = await localWait(page, (s) => s.expenses.find((e: any) => e.isDebtPayment && e.linkedDebtPaymentId === p.id))
    test.info().annotations.push({ type: 'evidence', description: `expense ${e.id} date=${e.date} occurredAt=${e.occurredAt ?? 'none'}; account openingAt=${qnb.openingAt}` })
    return p
  })
  await test.step('server: debt_payments + expense rows', async () => {
    const r = await serverRows('debt_payments', user.id, `id=eq.${pay.id}`, (r) => r.length === 1)
    expect(Number(r[0].amount)).toBe(700)
    expect(r[0].payment_method_id).toBe(qnb.id)
    await serverRows('expenses', user.id, `linked_debt_payment_id=eq.${pay.id}`, (r) => r.length === 1)
  })
  await test.step('reports show 700 of Debt spending', async () => {
    await goto(page, '/reports')
    await expect(page.locator('main')).toContainText('700')
  })
  await test.step('UI: QNB balance 5,000 -> 4,300', async () => {
    knownBug('E2E-002', 'the debt-payment expense has no occurredAt, so balance.ts dates it 12:00 of its day; it is skipped as future before noon and as pre-opening for an account opened after noon')
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText('4,300.00', { timeout: 10_000 })
  })
})

test('C2 debt > pay from Cash reaches the server [QA-030 / SYNC-001]', async ({ page, user }) => {
  const debt = await setupDebt(page, user.id)
  await payDebt(page, { debt: 'QA C loan', amount: 500, method: 'Cash' })
  await expect.poll(() => stillOwed(page)).toBe(2500)
  const pay = await localWait(page, (s) => s.debtPayments.find((x: any) => x.debtId === debt.id && x.amountPaid === 500))
  test.info().annotations.push({ type: 'evidence', description: `local debtPayment ${pay.id} paymentMethodId=${pay.paymentMethodId}` })
  knownBug('QA-030 / SYNC-001', 'Cash-funded debt payment is sent with payment_method_id pm_default_cash (400 22P02), parked, then marked delivered (SYNC-002)')
  try {
    await serverRows('debt_payments', user.id, `id=eq.${pay.id}`, (r) => r.length === 1, 25_000)
  } finally {
    const rows = await serverNow('debt_payments', user.id, '')
    test.info().annotations.push({ type: 'evidence', description: `server debt_payments rows for this user: ${rows.length}` })
  }
})
