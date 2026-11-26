import { beforeEach, describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { snapshot, emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { applyAssetPurchase } from '@/lib/savings/assetPurchase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { stampEdits } from '@/lib/supabase/remote/stampEdits'
import type { SavingsAccount } from '@/lib/store/types'

/**
 * QA W3 P1: gold bought from a pocket showed the "Withdrew" row, but after a reload the pocket still held the money.
 *
 * The live server (migration 0227, switch on) keeps its own `current_balance` on a client write and moves it only through
 * `savings_transactions` (trigger). The flush sent the pocket row first, so for a moment the server held the pocket with
 * the device's new edit stamp and the OLD balance. A pull landing there (another tab or device, or a reload) saw that row
 * as the newest edit, and the ledger update that followed changed no edit stamp, so nothing ever corrected it.
 */
function guardedServer(pockets: SavingsAccount[], userId: string) {
  const accounts = new Map<string, Record<string, unknown>>(
    pockets.map((p) => [p.id, { id: p.id, user_id: userId, current_balance: p.currentBalance, edited_at: p.updatedAt ?? null, name: p.name, currency: p.currency, category: p.category, type: p.type, created_at: p.createdAt, deleted_at: null }]),
  )
  const txs = new Set<string>()
  /** The pocket rows a pull would read after each write. */
  const seen: Record<string, unknown>[] = []
  const observe = () => { for (const a of accounts.values()) seen.push({ ...a }) }
  const client = {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        for (const row of rows) {
          if (table === 'savings_accounts') {
            const old = accounts.get(String(row.id))
            // a_balance_guard: an authenticated write keeps the server balance (a new pocket starts at 0).
            accounts.set(String(row.id), { ...old, ...row, current_balance: old ? old.current_balance : 0 })
          } else if (table === 'savings_transactions' && !txs.has(String(row.id))) {
            txs.add(String(row.id))
            // trg_savings_tx_delta: the ledger row moves the balance; edited_at is not touched.
            const a = accounts.get(String(row.account_id))
            if (a && !row.deleted_at) a.current_balance = Number(a.current_balance) + (row.kind === 'deposit' ? 1 : -1) * Number(row.amount)
          }
        }
        observe()
        return Promise.resolve({ error: null, count: rows.length })
      },
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { client, seen, accounts }
}

const PRICE = 4000
const pocket: SavingsAccount = {
  id: 'trip', name: 'Trip', type: 'cash', category: 'savings', currency: 'EGP', currentBalance: 1350,
  createdAt: '2026-11-26T06:15:56.000Z', updatedAt: '2026-11-26T06:19:08.000Z',
} as SavingsAccount

beforeEach(() => {
  useFinanceStore.setState({
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
    paymentMethods: [], savingsAccounts: [{ ...pocket }], savingsTransactions: [], investmentHoldings: [], expenses: [],
    incomeEvents: [], debtPayments: [], debts: [], accountAdjustments: [], goals: [], exchangeRates: {},
    goldPricePerGram: PRICE, goldPriceAvailable: true,
  })
})

async function buyGoldFromPocket(): Promise<{ before: Snapshot; after: Snapshot }> {
  const before = snapshot(useFinanceStore.getState())
  expect(applyAssetPurchase(useFinanceStore.getState(), {
    source: { kind: 'pocket', id: 'trip' }, paid: 1000, currency: 'EGP', priced: true, units: 0.25,
    holding: { assetType: 'gold', name: '21k gold', karat: 21, quantity: 0.25, goldUnit: 'grams', currency: 'EGP' },
    date: '2026-11-26', occurredAt: '2026-11-26T06:20:07.000Z',
  })).toBeNull()
  // The sync's subscriber stamps the pocket edit before the flush reads the store.
  const stamp = stampEdits(before, snapshot(useFinanceStore.getState()), '2026-11-26T06:20:07.388Z')
  if (stamp) useFinanceStore.setState(stamp)
  return { before, after: snapshot(useFinanceStore.getState()) }
}

describe('a pocket withdrawal and its pocket reach the server in a safe order (QA W3 P1)', () => {
  it('the device holds the pocket at 350 after the buy', async () => {
    const { after } = await buyGoldFromPocket()
    expect(after.savingsAccounts[0].currentBalance).toBe(350)
  })

  it('no pull can ever read the new edit stamp with the old balance', async () => {
    const { before, after } = await buyGoldFromPocket()
    const server = guardedServer(before.savingsAccounts, 'u1')
    const res = await flushDiff(server.client as never, 'u1', before, after)
    expect(res.anyError).toBe(false)
    const stamp = after.savingsAccounts[0].updatedAt
    for (const row of server.seen.filter((r) => r.id === 'trip')) {
      if (row.edited_at && Date.parse(String(row.edited_at)) === Date.parse(String(stamp))) expect(Number(row.current_balance)).toBe(350)
    }
    expect(Number(server.accounts.get('trip')!.current_balance)).toBe(350)
  })

  it('a balance-only pocket change goes out after the ledger rows, a new pocket before them', async () => {
    const order: string[] = []
    const client = {
      from: (table: string) => ({
        upsert: (rows: Record<string, unknown>[]) => {
          for (const r of rows) order.push(`${table}:${String(r.id)}`)
          return Promise.resolve({ error: null, count: rows.length })
        },
        update: () => ({ in: () => Promise.resolve({ error: null }) }),
      }),
    }
    const { before, after } = await buyGoldFromPocket()
    const fresh = { ...pocket, id: 'new', currentBalance: 0, updatedAt: undefined }
    await flushDiff(client as never, 'u1', { ...emptySnapshot(), ...before }, { ...after, savingsAccounts: [...after.savingsAccounts, fresh] })
    const tx = order.findIndex((o) => o.startsWith('savings_transactions:'))
    expect(order.indexOf('savings_accounts:new')).toBeLessThan(tx)
    expect(order.indexOf('savings_accounts:trip')).toBeGreaterThan(tx)
  })
})
