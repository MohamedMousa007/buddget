/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { PASSWORD, deleteUser, qaEmail, signupOtp } from '../lib/admin'
import { expect, goto, knownBug, localState, localWait, test, tile, moneyIn, netWorth, inAccounts } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addBorrow, addExpense, addMoneyIn, blur, dialog, fillAccountSheet, pickMethod, shown } from '../lib/ui'

/** Every card in the open "Payment methods" carousel, walked with the keyboard (its accessible path). */
async function carouselLabels(page: Page): Promise<string[]> {
  const group = page.getByRole('dialog', { name: 'Payment methods' }).getByRole('group').first()
  await group.focus()
  for (let i = 0; i < 10; i++) await group.press('ArrowLeft')
  const labels: string[] = []
  for (let i = 0; i < 12; i++) {
    const l = (await group.getAttribute('aria-label')) ?? ''
    if (labels.at(-1) === l) break
    labels.push(l)
    await group.press('ArrowRight')
  }
  return labels
}

test.describe('A registration and onboarding', () => {
  // onboarding_v1 is a 10% rollout; force it on so every fresh account gets the journey.
  test.use({ onboarding: true })

  test('A1 register through the app and confirm with the emailed code [E2E-001]', async ({ page }) => {
    const email = qaEmail('a1')
    test.info().annotations.push({ type: 'qa-user', description: email })
    try {
      await page.goto('/flow', { waitUntil: 'domcontentloaded' })
      await page.getByRole('textbox', { name: 'Email' }).fill(email)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Create my account' })).toBeVisible()
      await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
      await page.getByRole('button', { name: 'Create my account' }).click()
      await expect(page.getByRole('heading', { name: /Check your inbox/ })).toBeVisible()
      const boxes = page.getByRole('group', { name: 'Verification code' }).getByRole('textbox')
      await expect(boxes).toHaveCount(6)
      // GoTrue keeps only a hash of the emailed code; ask it for a fresh one of the same configured length (no email sent).
      const code = await signupOtp(email)
      test.info().annotations.push({ type: 'evidence', description: `project email OTP length = ${code.length}; the app's code step has 6 boxes and verifyOtpCode rejects any other length (useAuthModal.ts:497)` })
      expect(code.length, 'QA-10: Supabase OTP length must equal the 6 boxes').toBe(6)
      await boxes.first().click()
      await page.keyboard.type(code)
      await page.getByRole('button', { name: 'Confirm & get started' }).click()
      await expect(page.getByRole('button', { name: /^Profile menu/ }).or(page.getByRole('heading', { name: /What should I call you/ }))).toBeVisible({ timeout: 20_000 })
    } finally {
      await deleteUser(email).catch(() => undefined)
    }
  })

  async function onboardingAccounts(page: Page) {
    await expect(page).toHaveURL(/\/start$/, { timeout: 90_000 })
    // Seen once: the journey went back to step 1 right after the first pull. Retry the first two steps until step 3 shows.
    await expect(async () => {
      const name = page.getByRole('textbox', { name: 'Your name' })
      if (await name.isVisible()) {
        await name.fill('Qa')
        await page.getByRole('button', { name: 'Continue' }).click({ timeout: 2000 })
      }
      const goal = page.getByRole('button', { name: 'See where my money goes' })
      await goal.waitFor({ timeout: 3000 })
      if ((await goal.getAttribute('aria-pressed')) !== 'true') await goal.click({ timeout: 2000 })
      await page.getByRole('button', { name: 'Continue' }).click({ timeout: 2000 })
      await expect(page.getByRole('heading', { name: 'Where does your money live?' })).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'Where does your money live?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cash', exact: true }).click()
    await fillAccountSheet(page, { kind: 'Cash', balance: 1000 })
    await page.getByRole('button', { name: 'Bank account', exact: true }).click()
    await fillAccountSheet(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 400 })
    await expect(page.locator('main')).toContainText('QNB Alahli')
  }

  test('A2 onboarding accounts > income > budget studio keeps net worth at the money entered [QA-001]', async ({ page, user }) => {
    await onboardingAccounts(page)
    await test.step('accounts reveal 1,400, income 5,000 on the 25th', async () => {
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.locator('main')).toContainText(/Starting point\s*1,400\s*EGP/)
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.getByRole('textbox', { name: 'Take-home pay each month' }).fill('5000')
      await blur(page)
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.locator('main')).toContainText('5,000')
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.getByRole('button', { name: 'Build my budget' }).click()
      await expect(page).toHaveURL(/budget-setup/)
    })
    await test.step('studio: answer "How much do you have saved right now?" with what the accounts hold', async () => {
      const about = page.getByRole('textbox', { name: 'Tell me about yourself' })
      await about.fill('I earn 5000 a month on the 25th, I live with family, no debts')
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.getByRole('button', { name: 'Looks right, continue' }).click({ timeout: 90_000 })
      let sawSavings = false
      for (let i = 0; i < 70; i++) {
        await page.waitForTimeout(1500)
        const main = page.locator('main')
        if (await page.getByRole('button', { name: /^Check \d+ flagged$|^Activate plan$/ }).isVisible().catch(() => false)) break
        const h = ((await main.getByRole('heading').first().textContent().catch(() => '')) ?? '').trim()
        if (!/\?/.test(h)) continue
        const groups = main.getByRole('radiogroup')
        for (let g = 0; g < (await groups.count()); g++) {
          const grp = groups.nth(g)
          if (await grp.getByRole('radio', { checked: true }).count()) continue
          await grp.getByRole('radio').first().click({ timeout: 3000 }).catch(() => undefined)
        }
        const chips = main.getByRole('group', { name: h })
        if ((await chips.count()) && (await chips.getByRole('button').count()) && !(await chips.locator('[aria-pressed=true]').count())) await chips.getByRole('button').first().click({ timeout: 3000 }).catch(() => undefined)
        const checks = main.getByRole('checkbox')
        if ((await checks.count()) && !(await main.getByRole('checkbox', { checked: true }).count())) await checks.first().click({ timeout: 3000 }).catch(() => undefined)
        if (/saved right now/i.test(h)) sawSavings = true
        const boxes = main.getByRole('textbox')
        for (let b = 0; b < (await boxes.count()); b++) {
          const tb = boxes.nth(b)
          if (await tb.isVisible().catch(() => false) && !(await tb.inputValue())) await tb.fill(/saved right now/i.test(h) ? '1400' : '500')
        }
        test.info().annotations.push({ type: 'studio', description: h })
        const go = main.getByRole('button', { name: /^(Continue|Next|Done|Build)/ }).last()
        if (await go.isEnabled().catch(() => false)) await go.click()
      }
      test.info().annotations.push({ type: 'evidence', description: `studio asked the savings question: ${sawSavings}` })
    })
    // QA-12 (as built): with tracked accounts, "saved" money may only become a pocket EARMARKED inside an account, never above what is free.
    await page.waitForTimeout(4000)
    const st = await localState(page)
    const pockets = st.savingsAccounts.filter((a: any) => !a.deletedAt)
    test.info().annotations.push({ type: 'evidence', description: `pockets after studio: ${JSON.stringify(pockets.map((p: any) => ({ n: p.name, bal: p.currentBalance, linked: p.linkedPaymentMethodId ?? p.heldInPaymentMethodId ?? null })))}` })
    for (const p of pockets) expect(p.linkedPaymentMethodId ?? p.heldInPaymentMethodId, `pocket ${p.name} must be earmarked inside an account`).toBeTruthy()
    await goto(page, '/accounts')
    expect(await inAccounts(page)).toBe(1400)
    await goto(page, '/flow')
    expect(await netWorth(page)).toBe(1400)
  })

  test('A3 onboarding "Cash" shows one Cash in every picker [E2E-005 / QA-18]', async ({ page, user }) => {
    void user
    await onboardingAccounts(page)
    // QA-18 decision: the real "Cash" row next to the built-in pm_default_cash is by design (the built-in one is never
    // synced and holds no balance); what the user sees must be one Cash (fixed in 5240cfca, 6856ef0c).
    const methods = await localWait(page, (s) => s.paymentMethods.length >= 3 && s.paymentMethods)
    const cash = methods.filter((m: any) => m.type === 'cash' && !m.closedAt)
    test.info().annotations.push({ type: 'evidence', description: `cash methods in the store: ${JSON.stringify(cash.map((m: any) => ({ id: m.id, opening: m.openingBalance ?? null, isDefault: !!m.isDefault })))}` })
    await page.goto('/flow', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Quick add' }).first()).toBeVisible({ timeout: 60_000 })

    await test.step('expense method picker lists Cash once', async () => {
      await page.getByRole('button', { name: 'Quick add' }).first().click()
      await page.getByRole('dialog', { name: 'Add' }).getByRole('button', { name: /^Expense/ }).click()
      const d = page.getByRole('dialog', { name: 'Add expense' })
      await d.getByRole('button', { name: /^Paid with/ }).click()
      const labels = await carouselLabels(page)
      test.info().annotations.push({ type: 'evidence', description: `expense picker: ${labels.join(' | ')}` })
      expect(labels.filter((l) => /^Cash\b/.test(l))).toHaveLength(1)
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
    })
    await test.step('pay-debt method picker lists Cash once', async () => {
      await page.goto('/flow', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('button', { name: 'Quick add' }).first()).toBeVisible({ timeout: 60_000 })
      await addBorrow(page, { person: 'QA A3', what: 'QA A3 loan', amount: 100 })
      // Light touch: the debt row opens its actions; the payment's "Paid from" opens the same method carousel.
      await page.getByRole('button', { name: /^QA A3 loan/ }).first().click()
      await dialog(page, 'QA A3 loan').getByRole('radio', { name: 'Record a payment' }).click()
      const pay = page.getByRole('dialog', { name: 'Make a payment' })
      await pay.getByRole('button', { name: /^Paid from/ }).click()
      const labels = await carouselLabels(page)
      test.info().annotations.push({ type: 'evidence', description: `pay-debt picker: ${labels.join(' | ')}` })
      expect(labels.some((l) => /^QNB Alahli\b/.test(l))).toBe(true)
      expect(labels.filter((l) => /^Cash\b/.test(l))).toHaveLength(1)
    })
  })
})

test('A4 account > income > create/apply budget > expense > Flow and budget consumption', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: 8000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 8000))

  await test.step('money in 5,000 salary into QNB', async () => {
    await goto(page, '/flow')
    await addMoneyIn(page, { amount: 5000, name: 'QA Salary', method: /QNB/ })
    const ev = await localWait(page, (s) => s.incomeEvents.find((e: any) => e.name === 'QA Salary'))
    expect(ev).toMatchObject({ amount: 5000, paymentMethodId: qnb.id })
    await serverRows('income_events', user.id, `id=eq.${ev.id}`, (r: any[]) => r.length === 1 && Number(r[0].amount) === 5000)
    expect(await moneyIn(page)).toBe(5000)
    test.info().annotations.push({ type: 'evidence', description: `income event ${ev.id} receivedDate=${ev.receivedDate} occurredAt=${ev.occurredAt ?? 'none'}; QNB openingAt=${qnb.openingAt}` })
  })

  await test.step('salary payday 5,000 on the 25th into QNB (the budget templates are sized on it)', async () => {
    await goto(page, '/paydays')
    // With a payday already set, Add sits behind the quiet "Paydays and pay cycle" row (light touch).
    if (!(await page.getByRole('button', { name: 'Add a payday' }).isVisible())) await page.getByRole('button', { name: 'Paydays and pay cycle' }).click()
    await page.getByRole('button', { name: /^Add a payday/ }).first().click()
    const d = page.getByRole('dialog', { name: 'New payday' })
    await d.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await d.getByRole('textbox', { name: 'Name' }).fill('QA Payroll')
    // Light touch: the day sits behind a "Payday › 26th of each month" row (day picker + Done); the account behind "Received in".
    await d.getByRole('button', { name: /^Payday/ }).click()
    const day = dialog(page, 'Payday')
    await day.getByRole('radio', { name: '25', exact: true }).click()
    await day.getByRole('button', { name: 'Done' }).click()
    await expect(day).toBeHidden()
    await expect(d.getByRole('button', { name: /^Payday/ })).toContainText('25th')
    await d.getByRole('button', { name: /^Received in/ }).click()
    await pickMethod(page, /QNB/)
    await blur(page)
    await d.getByRole('button', { name: 'Add payday' }).click()
    await expect(d).toBeHidden()
    const src = await localWait(page, (s) => s.incomeSources.find((i: any) => i.name === 'QA Payroll'))
    await serverRows('income_sources', user.id, `id=eq.${src.id}`, (r: any[]) => r.length === 1 && Number(r[0].amount) === 5000 && r[0].day_of_month === 25)
  })

  const planId = await test.step('build a budget from my data and activate it', async () => {
    await goto(page, '/budget-setup')
    await page.getByRole('button', { name: 'Template' }).click()
    await page.getByRole('button', { name: 'Use my data' }).click()
    await page.getByRole('button', { name: 'Finish and review' }).click()
    const check = page.getByRole('button', { name: /^Check \d+ flagged$/ })
    if (await check.isVisible({ timeout: 5000 }).catch(() => false)) {
      await check.click()
      for (let i = 0; i < 10; i++) {
        const lr = page.getByRole('button', { name: 'Looks right' })
        if (!(await lr.isVisible({ timeout: 3000 }).catch(() => false))) break
        await lr.click()
      }
    }
    await page.getByRole('button', { name: 'Activate plan' }).click()
    const id = await localWait(page, (s) => s.activeBudgetPlanId)
    await serverRows('budget_plans', user.id, `id=eq.${id}`, (r: any[]) => r.length === 1 && r[0].status !== 'draft')
    await serverRows('budget_plan_activations', user.id, `plan_id=eq.${id}`, (r) => r.length >= 1)
    return id
  })

  let nwBefore = 0
  await test.step('spend 300 on Food from QNB', async () => {
    await goto(page, '/flow')
    nwBefore = await netWorth(page)
    await addExpense(page, { amount: 300, description: 'QA A lunch', category: 'Food', method: /QNB/ })
    const e = await localWait(page, (s) => s.expenses.find((x: any) => x.description === 'QA A lunch'))
    await serverRows('expenses', user.id, `id=eq.${e.id}`, (r: any[]) => r.length === 1 && r[0].payment_method_id === qnb.id)
    await goto(page, '/flow')
    await expect(page.locator('main').getByText(shown('300 EGP')).first()).toBeVisible()
    expect(await netWorth(page)).toBe(nwBefore - 300)
  })

  await test.step('budget shows the 300 consumed', async () => {
    await goto(page, '/budget-setup')
    await page.getByRole('radio', { name: 'Month' }).click()
    const txt = (await page.locator('main').textContent()) ?? ''
    const m = txt.match(/E£ ([\d,]+) left\s*of E£ ([\d,]+)/)
    expect(m, 'Everyday shows left of planned').not.toBeNull()
    const n = (s: string) => Number(s.replace(/,/g, ''))
    expect(n(m![2]) - n(m![1])).toBe(300)
    test.info().annotations.push({ type: 'evidence', description: `active plan ${planId}` })
  })

  await test.step('net worth counts the 5,000 received today: 8,000 + 5,000 - 300', async () => {
    await goto(page, '/flow')
    expect(await netWorth(page)).toBe(12700)
  })
})
