/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// Round 3. J7 / QA bug 9 (D15): an account the server made from an unknown SMS is "Not mine": it closes, leaves the lists,
// Undo reopens it, and a later SMS with the same digits lands on the closed row (no new account, no prompt back).
// QA bug 12 (D10, D11): income prompts show on Flow All and In, not Out; the pager dots reach card 2+; a sideways drag
// does not page, an upward swipe snoozes. QA bug 13 (D12): the expense editor shows a time only for a real same-day
// timestamp. BUD-104: one message caught twice by the same phone is booked twice and asked about as "caught twice". QA bug 10: screenshot of the account and card menu icons for the owner.
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { LOCAL } from '../../lib/apiShim'
import { expect, goto, localWait, test } from '../../lib/fixtures'
import { serverNow, serverRows } from '../../lib/server'
import { addExpense } from '../../lib/ui'
import { bank, seed } from './seed'
import { insertRows } from '../../lib/admin'

const EVIDENCE = resolve(__dirname, '../../../../docs/qa/round3/evidence')
const cairoDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

/** A phone for this synthetic user that may post SMS, and a sender for its messages. */
async function smsPhone(userId: string) {
  const device = `qa-r3-${randomUUID().slice(0, 8)}`
  const token = randomUUID()
  await insertRows('user_devices', userId, [{ device_id: device, platform: 'ios', model: 'QA iPhone', name: device, collects_sms: true }])
  await insertRows('sms_ingest_tokens', userId, [{ device_id: device, token_hash: createHash('sha256').update(token.toLowerCase()).digest('hex'), is_active: true }])
  return async (message: string, receivedAt: string, sender: string | null = 'CIB') => {
    const r = await fetch(`${LOCAL}/api/sms/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, ...(sender ? { sender } : {}), source: 'sms', receivedAt, eventId: randomUUID() }),
    })
    expect(r.status).toBe(200)
    return r.json()
  }
}

async function openFound(page: Page) {
  await goto(page, '/accounts')
  // With no account set up yet the Accounts page is its empty state, whose "Find my accounts" opens the same sheet.
  await page.getByRole('button', { name: /^1 account found/ }).or(page.getByRole('button', { name: 'Find my accounts' })).first().click()
  const sheet = page.getByRole('dialog').filter({ hasText: 'Seen in your bank messages' }).last()
  await sheet.getByRole('button', { name: /^CIB ••4821/ }).click()
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Not mine' }) }).last()
}

test('J7 an unknown account from SMS: Not mine closes it, Undo reopens it, its next SMS stays on the closed row [QA bug 9, D15]', async ({ page, user }) => {
  const sms = await smsPhone(user.id)
  const first = await sms('Your CIB credit card ending with#4821 was charged for EGP 41.00 at QA J7 SHOP ONE on 20/11/26', '2026-11-20T09:00:00+02:00')
  const [pm] = await serverRows('payment_methods', user.id, 'last4=eq.4821&select=id,provisional,closed_at', (r: any[]) => r.length === 1 && r[0].provisional === true)
  expect(first.expenseId).toBeTruthy()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === pm.id && m.provisional))

  await test.step('Not mine, then Undo: the account is back as a provisional one', async () => {
    const step = await openFound(page)
    await step.getByRole('button', { name: 'Not mine' }).click()
    await expect(page.getByText('CIB ••4821 hidden')).toBeVisible()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === pm.id && m.closedAt && m.excluded && !m.provisional))
    await page.getByRole('button', { name: 'Undo' }).click()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === pm.id && !m.closedAt && !m.excluded && m.provisional))
    await serverRows('payment_methods', user.id, `id=eq.${pm.id}`, (r: any[]) => r[0]?.provisional === true && r[0]?.closed_at === null)
  })

  await test.step('Not mine for good: closed and excluded on the server, gone from Accounts after a reload', async () => {
    const step = await openFound(page)
    await step.getByRole('button', { name: 'Not mine' }).click()
    await expect(page.getByText('CIB ••4821 hidden')).toBeVisible()
    await serverRows('payment_methods', user.id, `id=eq.${pm.id}`, (r: any[]) => !!r[0]?.closed_at && r[0]?.excluded === true && r[0]?.provisional === false, 40_000)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /CIB ••4821/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /account(s)? found/ })).toHaveCount(0)
  })

  await test.step('a later SMS with the same digits lands on the closed row: no new account, no prompt back', async () => {
    const second = await sms('Your CIB credit card ending with#4821 was charged for EGP 52.00 at QA J7 SHOP TWO on 21/11/26', '2026-11-21T09:00:00+02:00')
    expect(second.ok).toBe(true)
    const methods = await serverNow('payment_methods', user.id, 'last4=eq.4821&select=id,closed_at,excluded')
    expect(methods).toHaveLength(1)
    expect(methods[0]).toMatchObject({ id: pm.id, excluded: true })
    expect(methods[0].closed_at).toBeTruthy()
    expect(second.expenseId).toBeTruthy()
    const [e] = await serverNow('expenses', user.id, `id=eq.${second.expenseId}&select=payment_method_id`)
    expect(e.payment_method_id).toBe(pm.id)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /account(s)? found/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /CIB ••4821/ })).toHaveCount(0)
  })
})

/** The two most recent weekdays at least `minLate` days before today (Cairo), oldest first. */
function latePaydays(minLate: number): Date[] {
  const out: Date[] = []
  const d = new Date(Date.now() - minLate * 86_400_000)
  while (out.length < 2) {
    const wd = new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).getDay()
    if (wd !== 0 && wd !== 6 && wd !== 5) out.unshift(new Date(d))
    d.setTime(d.getTime() - 86_400_000)
  }
  return out
}

test('J12 income prompts on Flow All and In (not Out); dots reach card 2; sideways drag does not page, swipe up snoozes [QA bug 12]', async ({ page, user }) => {
  const [a, b] = latePaydays(8)
  const source = (name: string, d: Date) => {
    const dom = Number(cairoDay(d).slice(8))
    return { name, amount: 10000, currency: 'EGP', is_recurring: true, recurring_frequency: 'monthly', day_of_month: dom, payday_days: [dom], effective_start: cairoDay(new Date(d.getTime() - 3 * 86_400_000)), source_type: 'salary' }
  }
  await seed(page, user.id, 'income_sources', [source('QA Salary A', a), source('QA Salary B', b)])
  await localWait(page, (s) => s.incomeSources.filter((x: any) => x.name.startsWith('QA Salary')).length === 2)

  const late = page.getByText(/^QA Salary [AB] · \d+ days? late$/)
  // Only the front card is rendered; a card that is leaving stays in the DOM for its exit animation, so wait for one.
  const frontTitle = async () => {
    await expect(late).toHaveCount(1)
    return ((await late.textContent()) ?? '').match(/QA Salary [AB]/)?.[0] ?? null
  }
  const segment = (name: 'All' | 'In' | 'Out') => page.getByRole('radiogroup', { name: 'Filter by direction' }).getByRole('radio', { name, exact: true })

  await goto(page, '/flow')
  await test.step('All shows them, Out hides them, In shows them again', async () => {
    await expect(segment('All')).toHaveAttribute('aria-checked', 'true')
    await expect(late.first()).toBeVisible()
    await segment('Out').click()
    await expect(late).toHaveCount(0)
    await segment('In').click()
    await expect(late.first()).toBeVisible()
    await segment('All').click()
    await expect(late.first()).toBeVisible()
  })

  await test.step('the pager dots are buttons that bring card 2 to the front', async () => {
    const front = await frontTitle()
    expect(front).toBe('QA Salary A')
    const dot2 = page.getByRole('button', { name: /^2 of \d+$/ }).first()
    await expect(dot2).toBeVisible()
    await dot2.click()
    await expect.poll(frontTitle).toBe('QA Salary B')
  })

  await test.step('a sideways drag leaves the front card; an upward swipe snoozes it', async () => {
    const front = await frontTitle()
    const box = (await late.first().boundingBox())!
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 160, y, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(600)
    expect(await frontTitle()).toBe(front)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y - 140, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByText(/^Snoozed · back at/)).toBeVisible()
  })
})

test('J13 the expense editor shows a time only for a real same-day timestamp [QA bug 13, D12]', async ({ page, user }) => {
  const today = cairoDay(new Date())
  const yesterday = cairoDay(new Date(Date.now() - 86_400_000))
  await seed(page, user.id, 'expenses', [
    { amount: 30, currency: 'EGP', category: 'Food', description: 'QA J13 back-dated', expense_date: yesterday, occurred_at: null },
    { amount: 31, currency: 'EGP', category: 'Food', description: 'QA J13 noon stand-in', expense_date: today, occurred_at: new Date(`${today}T12:00:00+02:00`).toISOString() },
  ])
  await localWait(page, (s) => s.expenses.filter((e: any) => e.description.startsWith('QA J13')).length === 2)
  await goto(page, '/flow')
  await addExpense(page, { amount: 32, description: 'QA J13 just now', category: 'Food' })
  await localWait(page, (s) => s.expenses.find((e: any) => e.description === 'QA J13 just now' && e.occurredAt))

  const editorPill = async (description: string) => {
    await goto(page, '/flow')
    await page.getByRole('button', { name: new RegExp(description) }).first().click()
    const editor = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Description' }) }).last()
    await expect(editor.getByRole('textbox', { name: 'Description' })).toHaveValue(description)
    const pill = editor.locator('[aria-haspopup="dialog"]').filter({ hasText: /Today|Yesterday|\d/ }).first()
    const text = ((await pill.textContent()) ?? '').replace(/\s+/g, ' ').trim()
    await page.keyboard.press('Escape')
    await expect(editor).toBeHidden()
    return text
  }
  expect(await editorPill('QA J13 just now')).toMatch(/^Today\s?· \d{1,2}:\d{2}\s?(AM|PM)$/)
  expect(await editorPill('QA J13 noon stand-in')).not.toContain('·')
  expect(await editorPill('QA J13 back-dated')).not.toContain('·')
})

test('J10 evidence: the account sheet and card menu icons for the owner [QA bug 10]', async ({ page, user }) => {
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 4000)])
  await seed(page, user.id, 'payment_methods', [{ name: 'QNB Alahli', type: 'debit_card', currency: 'EGP', color: '#1f6feb', parent_id: qnb.id, last4: '1111' }])
  await localWait(page, (s) => s.paymentMethods.find((m: any) => m.parentId === qnb.id))
  await goto(page, '/accounts')
  await page.getByRole('button', { name: /QNB Alahli/ }).first().click()
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Update' }) }).last()
  const header = sheet.getByRole('button', { name: 'More actions' }).first()
  const card = sheet.getByRole('button', { name: 'Manage' }).first()
  await expect(header).toHaveAttribute('aria-haspopup', 'menu')
  await expect(card).toHaveAttribute('aria-haspopup', 'menu')
  // The card's button is drawn at 32 px; IconButton's invisible ::after overlay keeps its tap area at 44 px.
  for (const b of [header, card]) {
    const tap = await b.evaluate((el) => {
      const a = getComputedStyle(el, '::after'), r = el.getBoundingClientRect()
      return Math.min(Math.max(r.width, parseFloat(a.minWidth) || 0), Math.max(r.height, parseFloat(a.minHeight) || 0))
    })
    expect(tap).toBeGreaterThanOrEqual(44)
  }
  mkdirSync(EVIDENCE, { recursive: true })
  await page.waitForTimeout(500)
  await sheet.screenshot({ path: `${EVIDENCE}/bug10-account-sheet-menus.png` })
  await card.click()
  await expect(page.getByRole('menuitem').first()).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/bug10-card-menu-open.png` })
})

test('J14 the same message caught twice by one phone: both booked, Flow asks with the "caught twice" wording; Keep both keeps them [BUD-104]', async ({ page, user }) => {
  const sms = await smsPhone(user.id)
  const now = new Date()
  const [y, m, d] = cairoDay(now).split('-')
  const text = `Account ***3307 was debited EGP 45.00 for purchase at QATWINCAFE on ${d}-${m}-${y} 10:00.`
  await sms(text, new Date(now.getTime() - 20_000).toISOString(), null)
  await sms(text, new Date(now.getTime() - 10_000).toISOString(), null)
  await serverRows('expenses', user.id, 'description=ilike.*QATWINCAFE*&deleted_at=is.null&select=id', (r: any[]) => r.length === 2)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await localWait(page, (s) => s.expenses.filter((e: any) => /QATWINCAFE/i.test(e.description)).length === 2)
  await goto(page, '/flow')
  await expect(page.getByText('Is this a repeat of the same message?')).toBeVisible()
  await expect(page.getByText(/This phone caught the same message twice within seconds\. Remove this one if it is a repeat\./)).toBeVisible()
  await expect(page.getByText(/Two messages with the same text arrived within minutes/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Keep both' }).click()
  await expect(page.getByText('Is this a repeat of the same message?')).toHaveCount(0)
  await serverRows('expenses', user.id, 'description=ilike.*QATWINCAFE*&deleted_at=is.null&select=id', (r: any[]) => r.length === 2)
})
