// Round 3, BUD-105/106 (PR #38): when what the user types disagrees with what Buddget tracks, the planner asks one
// question at a time which is right (nothing silent), resumes at the same question after a reload, then shows a review
// whose rows are tappable and whose costs, utilities and holdings open small editors.
// The AI reading of the typed text (POST /api/budget/ai, op "situation") is stubbed with a fixed reading so the journey
// is deterministic; every other planner call goes to the real server. The reading itself is unit-tested (situationAi.test.ts).
import type { Page } from '@playwright/test'
import { expect, goto, localWait, test } from '../../lib/fixtures'
import { blur } from '../../lib/ui'
import { seed } from './seed'

const READING = { income: 9000, incomeType: 'salary', hasDebts: false, utilities: 800, commitments: ['Gym|500'], holdings: ['gold|50000'] }

async function stubSituation(page: Page) {
  await page.route(/\/api\/budget\/ai(\?|$)/, async (route) => {
    const req = route.request()
    const cors = { 'access-control-allow-origin': req.headers()['origin'] ?? '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (req.postDataJSON()?.op !== 'situation') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: READING }) })
  })
}

const pending = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('buddget-ui-settings') ?? '{}')?.state?.budgetStudioDraft?.state?.pending ?? null)

async function openSaveMore(page: Page) {
  await goto(page, '/budget-setup')
  await page.getByRole('button', { name: /^Save more/ }).click()
}

test('P1 typed text that disagrees with tracked data: one question at a time, resume-safe, tappable review rows and editors [BUD-105, BUD-106]', async ({ page, user }) => {
  await seed(page, user.id, 'income_sources', [{ name: 'QA Pay', amount: 5000, currency: 'EGP', is_recurring: true, recurring_frequency: 'monthly', day_of_month: 1, payday_days: [1], effective_start: '2026-01-01', source_type: 'salary' }])
  await seed(page, user.id, 'debts', [{ name: 'QA P1 loan', person: 'Sara', amount: 2000, remaining_amount: 2000, currency: 'EGP', debt_type: 'personal', direction: 'i_owe', status: 'active' }])
  await localWait(page, (s) => s.incomeSources.length === 1 && s.debts.length === 1)
  await stubSituation(page)
  await openSaveMore(page)

  await test.step('the description is read and the first disagreement is asked on its own', async () => {
    await page.getByRole('textbox', { name: 'Tell me about yourself' }).fill('I earn 9000 a month, I owe nothing, gym 500, utilities 800, I have gold worth 50000')
    await blur(page)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText('1 of 2 to check')).toBeVisible()
    await expect(page.getByRole('heading', { name: /: which is right\?$/ })).toBeVisible()
    await expect(page.getByText('What you wrote does not match what Buddgy already has. Pick the one to plan with.')).toBeVisible()
    const choices = page.getByRole('radiogroup').getByRole('radio')
    await expect(choices).toHaveCount(2)
    await expect(page.getByRole('radio', { name: /^In Buddget/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^What you just wrote/ })).toBeVisible()
  })

  const firstHeading = await page.getByRole('heading', { name: /which is right\?$/ }).textContent()
  await test.step('pick what I wrote: the second question comes, and the choice is saved on the device', async () => {
    await page.getByRole('radio', { name: /^What you just wrote/ }).click()
    await expect(page.getByText('2 of 2 to check')).toBeVisible()
    await expect(page.getByRole('heading', { name: /which is right\?$/ })).not.toHaveText(firstHeading!)
    await expect.poll(async () => Object.keys((await pending(page))?.choices ?? {}).length).toBe(1)
  })

  await test.step('reload and reopen the same plan: it resumes at question 2, not the start', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await stubSituation(page)
    await openSaveMore(page)
    await expect(page.getByText('2 of 2 to check')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Tell me about yourself' })).toHaveCount(0)
  })

  await test.step('keep my records for the second: the review lists what was picked up', async () => {
    await page.getByRole('button', { name: 'Keep my records for now' }).click()
    await expect(page.getByRole('heading', { name: /^I picked up \d+ things?$/ })).toBeVisible()
    await expect(page.getByText('Tap a line to change it. I will ask about the rest.')).toBeVisible()
    // Question 1 (income) took what was typed; question 2 (debts) kept the tracked debt, so no "owe nothing" line.
    await expect(page.getByRole('button', { name: 'Change: What do you take home in a normal month?, E£ 9,000' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Change: .*(debt|owe)/i })).toHaveCount(0)
  })

  await test.step('rows are tappable: the cost row opens its editor and saves a new amount', async () => {
    await page.getByRole('button', { name: /^Change: Gym, E£ 500$/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Change this cost' })
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Gym')
    await sheet.getByRole('textbox', { name: 'Each month' }).fill('650')
    await blur(page)
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: /^Change: Gym, E£ 650$/ })).toBeVisible()
  })

  await test.step('utilities and holdings open their own small editors', async () => {
    await page.getByRole('button', { name: /^Change: Electricity, water and gas, E£ 800$/ }).click()
    const util = page.getByRole('dialog', { name: 'Electricity, water and gas' })
    await expect(util.getByRole('textbox', { name: 'Each month' })).toHaveValue(/^800/)
    await expect(util.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
    await util.getByRole('button', { name: 'Close' }).click()
    await expect(util).toBeHidden()
    await page.getByRole('button', { name: /^Change: Gold, E£ 50,000$/ }).click()
    const gold = page.getByRole('dialog', { name: 'Gold' })
    await gold.getByRole('textbox', { name: 'Total value' }).fill('60000')
    await blur(page)
    await gold.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(gold).toBeHidden()
    await expect(page.getByRole('button', { name: /^Change: Gold, E£ 60,000$/ })).toBeVisible()
  })
})
