import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { namesOwnWallet, isOwnWalletMerchant } from './pairing'
import { createSmsTransaction } from './dispatch'
import type { SmsRowData } from './createSmsExpense'

/**
 * Loading your own wallet emits two SMS and Buddget believed both: the funding card's
 * bank ("Online Purchase ... From: barq") posted a 2 SAR expense, and Barq ("Money Added
 * to your Barq wallet") posted 2 SAR of income. Same own money, booked as spend AND
 * income — and the purchase later made from the wallet counted it a third time.
 *
 * The two legs arrive in either order, seconds apart, so BOTH orders must end at exactly
 * one non-spend Transfer row. The first attempt at this fix passed its unit tests and
 * still failed both orders: it reclassified a local variable, while `sms_try_pair` matches
 * siblings on the persisted `kind` COLUMN. Hence the row-count assertions below — a green
 * string-matcher test cannot see that class of bug.
 */

// ── Fake service ────────────────────────────────────────────────────────────────
// Models only what dispatch touches: the wallet lookup, the pairing RPC, and inserts.
interface FakeState {
  wallets: Array<{ name: string }>
  /** Rows the RPC can pair against, keyed as the log would persist them. */
  logs: Array<{ id: string; kind: string; amount: number; expense_id: string | null; income_id: string | null; paired: boolean }>
  expenses: Array<{ id: string; category: string; deleted: boolean }>
  incomes: Array<{ id: string; deleted: boolean }>
}

function makeService(state: FakeState) {
  const rpc = vi.fn(async (_name: string, params: Record<string, unknown>) => {
    const kinds = params.p_match_kinds as string[]
    const amount = params.p_amount as number
    const hit = state.logs.find((l) => !l.paired && kinds.includes(l.kind) && l.amount === amount)
    if (!hit) return { data: [], error: null }
    hit.paired = true
    return {
      data: [{
        sibling_id: hit.id,
        sibling_kind: hit.kind,
        sibling_expense_id: hit.expense_id,
        sibling_income_id: hit.income_id,
        sibling_status: 'logged',
      }],
      error: null,
    }
  })

  /** Chainable + awaitable PostgREST stand-in: every filter returns `this`. */
  const q = (rows: unknown[], onInsert?: (r: Record<string, unknown>) => string, onUpdate?: (patch: Record<string, unknown>, id: string) => void) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (_c?: string, _v?: unknown) => chain,
      neq: () => chain,
      is: () => chain,
      not: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (r: (v: unknown) => unknown) => r({ data: rows, error: null }),
      insert: (r: Record<string, unknown>) => {
        const id = onInsert ? onInsert(r) : 'x'
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id }, error: null }) }),
          then: (res: (v: unknown) => unknown) => res({ data: null, error: null }),
        }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_c: string, id: string) => {
          onUpdate?.(patch, id)
          return Promise.resolve({ error: null, data: null })
        },
      }),
    }
    return chain
  }

  const from = (table: string) => {
    if (table === 'payment_methods') return q(state.wallets)
    if (table === 'expenses')
      return q(
        [],
        (r) => {
          const id = `e${state.expenses.length + 1}`
          state.expenses.push({ id, category: String(r.category), deleted: false })
          return id
        },
        (patch, id) => {
          if (patch.deleted_at) {
            const e = state.expenses.find((x) => x.id === id)
            if (e) e.deleted = true
          }
        },
      )
    // income_events is where a one-time SMS income actually lands, and what
    // sms_parse_log.income_id points at — modelling it as income_sources would let a
    // retraction that hits the wrong table look like a pass.
    if (table === 'income_events')
      return q(
        [],
        () => {
          const id = `i${state.incomes.length + 1}`
          state.incomes.push({ id, deleted: false })
          return id
        },
        (patch, id) => {
          if (patch.deleted_at) {
            const i = state.incomes.find((x) => x.id === id)
            if (i) i.deleted = true
          }
        },
      )
    return q([]) // sms_parse_log, subscriptions, debts: accept writes, match nothing
  }

  return { from, rpc } as unknown as SupabaseClient
}

const BARQ_CREDIT = 'Money Added to your Barq wallet\namount: 2.0 SAR\nvia: Apple pay\ncard number: **8639'

function leg(over: Partial<SmsRowData>): SmsRowData {
  return {
    userId: 'u1',
    amount: 2,
    currency: 'SAR',
    day: '2026-07-16',
    kind: 'online_purchase',
    cleanTitle: null,
    merchantNormalized: null,
    merchant: 'barq',
    bankName: null,
    categoryHint: null,
    source: 'sms',
    rawBody: 'Online Purchase Transaction Amount 2 SAR \nFrom: barq\n Card: *8639',
    last4: '8639',
    counterpartyLast4: null,
    receivedAtIso: '2026-07-16T20:34:53Z',
    logId: 'log-funding',
    ...over,
  } as SmsRowData
}

const walletLeg = (): SmsRowData =>
  leg({ kind: 'income', merchant: 'Apple pay', rawBody: BARQ_CREDIT, last4: null, logId: 'log-wallet' })

// The log row each leg leaves behind, written with the APPLIED kind by the route.
function persist(state: FakeState, id: string, res: { kind: string | null; expenseId: string | null; incomeId: string | null }) {
  state.logs.push({
    id, kind: res.kind ?? 'other', amount: 2,
    expense_id: res.expenseId, income_id: res.incomeId, paired: false,
  })
}

let state: FakeState
const opts = { exchangeRates: {} }
beforeEach(() => {
  state = { wallets: [{ name: 'Barq' }], logs: [], expenses: [], incomes: [] }
})

describe('own-wallet top-up — end state, both arrival orders', () => {
  it('funding leg first, wallet leg second → exactly one non-spend Transfer', async () => {
    const svc = makeService(state)

    const a = await createSmsTransaction(svc, leg({}), opts)
    expect(a.kind).toBe('own_transfer') // must persist, or the wallet leg can never find it
    persist(state, 'log-funding', a)

    const b = await createSmsTransaction(svc, walletLeg(), opts)
    expect(b.outcome).toBe('transfer_paired')

    const live = state.expenses.filter((e) => !e.deleted)
    expect(live).toHaveLength(1)
    expect(live[0].category).toBe('Transfer')
    expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(0)
  })

  it('wallet leg first, funding leg second → exactly one non-spend Transfer', async () => {
    const svc = makeService(state)

    const a = await createSmsTransaction(svc, walletLeg(), opts)
    expect(a.outcome).toBe('income') // no funding leg yet — correctly provisional income
    expect(a.kind).toBe('instant_transfer_in') // ...but pairable when the funding leg lands
    persist(state, 'log-wallet', a)

    const b = await createSmsTransaction(svc, leg({}), opts)
    expect(b.outcome).toBe('transfer_paired')

    const live = state.expenses.filter((e) => !e.deleted)
    expect(live).toHaveLength(1)
    expect(live[0].category).toBe('Transfer')
    // The provisional income must be retracted, not left alongside the transfer.
    expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(0)
  })

  it('a wallet credit with no funding leg stays income (a friend sent it)', async () => {
    const svc = makeService(state)
    const res = await createSmsTransaction(svc, walletLeg(), opts)
    expect(res.outcome).toBe('income')
    expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(1)
    expect(state.expenses.filter((e) => !e.deleted)).toHaveLength(0)
  })

  it('spending FROM the wallet stays spend', async () => {
    const svc = makeService(state)
    const res = await createSmsTransaction(
      svc,
      leg({ merchant: 'Carrefour', rawBody: 'Purchase at Carrefour 50 SAR from your Barq wallet' }),
      opts,
    )
    expect(res.kind).toBe('online_purchase')
    expect(state.expenses.filter((e) => !e.deleted)).toHaveLength(1)
  })
})

// ── Matchers ────────────────────────────────────────────────────────────────────
function stub(wallets: Array<{ name: string }>): SupabaseClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => Promise.resolve({ data: wallets }),
  }
  return { from: () => chain } as unknown as SupabaseClient
}

describe('isOwnWalletMerchant — strict, because a wallet brand can also be a merchant', () => {
  it('matches the funding leg whose merchant IS the wallet', async () => {
    expect(await isOwnWalletMerchant(stub([{ name: 'Barq' }]), 'u1', 'barq')).toBe(true)
  })

  it('still matches when the user tagged the method', async () => {
    expect(await isOwnWalletMerchant(stub([{ name: 'Barq · Personal' }]), 'u1', 'barq')).toBe(true)
  })

  it('does not turn a Careem ride into a transfer', async () => {
    // 'careem' is a catalogue alias of the Careem Pay wallet; alias matching here would
    // erase every ride from spend.
    expect(await isOwnWalletMerchant(stub([{ name: 'Careem Pay' }]), 'u1', 'Careem')).toBe(false)
  })

  it('does not turn a shop whose name contains the wallet into a transfer', async () => {
    expect(await isOwnWalletMerchant(stub([{ name: 'Lucky' }]), 'u1', 'Lucky Market')).toBe(false)
  })

  it('ignores pass-through rails, which hold no balance to top up', async () => {
    // Apple Pay is type:'wallet' and sits in the SA/AE quick-add lists, so this is a
    // configuration real users will have.
    expect(await isOwnWalletMerchant(stub([{ name: 'Apple Pay' }]), 'u1', 'Apple Pay')).toBe(false)
    expect(await isOwnWalletMerchant(stub([{ name: 'InstaPay' }]), 'u1', 'InstaPay')).toBe(false)
  })
})

describe('namesOwnWallet — lenient, because the name sits inside a sentence', () => {
  it("matches the wallet's own credit SMS", async () => {
    expect(await namesOwnWallet(stub([{ name: 'Barq' }]), 'u1', BARQ_CREDIT)).toBe(true)
  })

  it('does not match a longer word that merely contains the name', async () => {
    expect(await namesOwnWallet(stub([{ name: 'Barq' }]), 'u1', 'POS Purchase at Barqawi Restaurant')).toBe(false)
  })

  it('ignores names too short to match safely', async () => {
    expect(await namesOwnWallet(stub([{ name: 'Q' }]), 'u1', 'Online Purchase Q8 fuel')).toBe(false)
  })

  it('is false when the user has registered no wallet', async () => {
    expect(await namesOwnWallet(stub([]), 'u1', BARQ_CREDIT)).toBe(false)
  })

  it('does not treat regex metacharacters in a name as a pattern', async () => {
    // Deliberately a name no catalogue brand resolves to: isPassThroughBrand is lenient
    // (e.g. "Pay.Me" resolves to InstaPay via the alias "instant payment") and would
    // filter the wallet out before the regex ever ran, hiding what this asserts.
    expect(await namesOwnWallet(stub([{ name: 'Mint.Box' }]), 'u1', 'Money added to MintXBox')).toBe(false)
    expect(await namesOwnWallet(stub([{ name: 'Mint.Box' }]), 'u1', 'Money added to Mint.Box')).toBe(true)
  })

  it('ignores pass-through rails', async () => {
    expect(await namesOwnWallet(stub([{ name: 'Apple Pay' }]), 'u1', BARQ_CREDIT)).toBe(false)
  })
})
