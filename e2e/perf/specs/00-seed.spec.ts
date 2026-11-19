/* eslint-disable @typescript-eslint/no-explicit-any -- seed reads untyped PostgREST JSON */
import { test } from '@playwright/test'
import { PASSWORD, QA_DOMAIN, createConfirmedUser, qaEmail } from '../../journeys/lib/admin'
import { env } from '../../journeys/lib/env'
import { writeJson } from '../lib'

/** Seeds one small and one large synthetic user. The large user gets 3,000 expenses over 12 months, in batches of 500 (service role, own user id only). */
const CATS = ['Food', 'Groceries', 'Transport', 'Fuel', 'Shopping', 'Utilities', 'Health', 'Enjoyment', 'Education', 'Other']

async function insert(table: string, rows: any[]) {
  const r = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_SECRET_KEY'), Authorization: `Bearer ${env('SUPABASE_SECRET_KEY')}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!r.ok) throw new Error(`insert ${table} -> ${r.status} ${(await r.text()).slice(0, 300)}`)
}

function expenseRows(userId: string, n: number, days: number) {
  const out: any[] = []
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    const d = new Date(now - Math.floor((i / n) * days) * 86400000)
    out.push({
      id: crypto.randomUUID(), user_id: userId, description: `QA perf ${i}`,
      category: CATS[i % CATS.length], category_label: CATS[i % CATS.length],
      amount: 20 + ((i * 37) % 480), currency: 'EGP', expense_date: d.toISOString().slice(0, 10),
    })
  }
  return out
}

test('seed small + large synthetic users', async () => {
  test.setTimeout(900_000)
  const out: any = {}
  for (const [tag, n, days] of [['pfs', 25, 30], ['pfl', 3000, 365]] as const) {
    const email = qaEmail(tag)
    const id = await createConfirmedUser(email)
    out[tag === 'pfs' ? 'small' : 'large'] = { email, id }
    writeJson('users.json', out) // written early so teardown can always find them
    const rows = expenseRows(id, n, days)
    for (let i = 0; i < rows.length; i += 500) await insert('expenses', rows.slice(i, i + 500))
    // income, so Reports/Wealth have more than one series
    const inc = Array.from({ length: tag === 'pfl' ? 12 : 1 }, (_, m) => ({
      id: crypto.randomUUID(), user_id: id, name: 'QA salary', amount: 30000, currency: 'EGP',
      received_date: new Date(Date.now() - m * 30 * 86400000).toISOString().slice(0, 10),
    }))
    await insert('income_events', inc).catch((e) => console.log('income seed skipped:', String(e).slice(0, 200)))
  }
  void PASSWORD; void QA_DOMAIN
})
