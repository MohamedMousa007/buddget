/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { insertRows } from '../../lib/admin'
import { localWait, waitSynced } from '../../lib/fixtures'

/** Inserts rows for the signed-in synthetic user on the server, then reloads so the app pulls them. */
export async function seed(page: Page, userId: string, table: string, data: Record<string, unknown>[]): Promise<any[]> {
  const out = await insertRows(table, userId, data.map((r) => ({ id: randomUUID(), ...r })))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitSynced(page)
  return out
}

const now = () => new Date().toISOString()
export const bank = (name: string, balance: number, extra: Record<string, unknown> = {}) =>
  ({ name, type: 'bank_account', currency: 'EGP', color: '#1f6feb', opening_balance: balance, opening_at: now(), ...extra })

/** Waits until the store holds a payment method with this server id. */
export const localMethod = (page: Page, id: string) => localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === id))
