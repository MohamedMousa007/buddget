/* eslint-disable @typescript-eslint/no-explicit-any -- in-page globals */
import { expect, type Page } from '@playwright/test'
import { pickCategory } from '../journeys/lib/ui'
import { longTaskMs, settle, type netLog } from './lib'

export async function openProfileLink(page: Page, name: string) {
  await page.getByRole('button', { name: /^Profile menu/ }).click()
  await page.getByRole('menuitem', { name, exact: false }).first().click()
}

/** Fills and saves an expense in the open sheet; measures Save click -> sheet closed and -> row on the screen. */
export async function addExpenseFast(page: Page, m: Record<string, number>, net: ReturnType<typeof netLog>, desc: string) {
  const d = page.getByRole('dialog', { name: 'Add expense' })
  await d.getByRole('textbox', { name: 'Amount' }).fill('123')
  await d.getByRole('textbox', { name: 'Description' }).fill(desc)
  // Light touch: the category sits behind a "Category › Choose" row.
  await pickCategory(page, d, 'Food')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.waitForTimeout(300)
  net.step = 'save_expense'
  await page.evaluate(() => { (window as any).__perf.pointer = 0 })
  await d.getByRole('button', { name: 'Save expense' }).click()
  await expect(d).toBeHidden()
  const t1 = await page.evaluate(() => performance.now())
  await settle(page, 700)
  const p = await page.evaluate(() => (window as any).__perf)
  m.save_expense_sheet_closed_ms = Math.round(t1 - p.pointer)
  m.save_expense_longtask_ms = await longTaskMs(page, p.pointer, t1 + 700)
  const t0 = Date.now()
  await page.getByText(desc).first().waitFor({ timeout: 30000 }).catch(() => undefined)
  m.save_expense_row_visible_after_ms = Date.now() - t0
  await net.quiet(2500, 15000)
}
