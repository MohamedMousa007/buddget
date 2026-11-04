import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useAssetPricesStore } from '@/lib/store/useAssetPricesStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal, InvestmentHolding, SavingsAccount } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const ctxAr: ToolContext = { now: ctx.now, locale: 'ar' }

const A1 = 'a1a1a1a1-0000-0000-0000-000000000001'
const A2 = 'b2b2b2b2-0000-0000-0000-000000000002'
const A3 = 'c3c3c3c3-0000-0000-0000-000000000003'
const GL = 'd4d4d4d4-0000-0000-0000-000000000004'
const H1 = 'e5e5e5e5-0000-0000-0000-000000000005'
const H2 = 'f6f6f6f6-0000-0000-0000-000000000006'

const account = (id: string, over: Partial<SavingsAccount> = {}): SavingsAccount => ({
  id,
  name: 'CIB',
  category: 'savings',
  type: 'bank',
  currency: 'EGP',
  currentBalance: 1000,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: GL,
  name: 'Car',
  emoji: '🚗',
  category: 'car',
  targetAmount: 1500,
  currency: 'EGP',
  manualCurrentAmount: 0,
  targetDate: '2027-10-01',
  linkedSavingsAccountIds: [A1],
  linkedDebtIds: [],
  monthlySpendingLimit: null,
  priority: 0,
  status: 'active',
  monthlyContribution: null,
  fundingMode: 'manual',
  sharePct: null,
  frequency: 'monthly',
  planStart: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  achievedAt: null,
  ...over,
})

const holding = (id: string, over: Partial<InvestmentHolding> = {}): InvestmentHolding => ({
  id,
  assetType: 'gold',
  name: '21k gold',
  quantity: 10,
  currency: 'EGP',
  karat: 21,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string, args: Record<string, unknown> = {}) => {
  const r = TOOLS.get(name)?.read
  if (!r) throw new Error(`no read tool ${name}`)
  return r(args, ctx) as Record<string, unknown>
}
const st = () => useFinanceStore.getState()
const bal = (id: string) => st().savingsAccounts.find((a) => a.id === id)?.currentBalance

const fresh = new Date().toISOString()
const price = (symbol: string, currency: string, p: number) => [`${symbol}:${currency}`, { symbol, currency, price: p, asOf: fresh, assetClass: 'metal', confidence: null }] as const

beforeEach(() => {
  useAssetPricesStore.setState({ prices: {}, lastFetch: null })
  useFinanceStore.setState({
    savingsAccounts: [account(A1), account(A2, { name: 'Cash', type: 'cash', currentBalance: 200 })],
    savingsTransactions: [],
    recurringSavingsDeposits: [],
    investmentHoldings: [],
    incomeSources: [],
    incomeEvents: [],
    goals: [],
    debts: [],
    debtPayments: [],
    expenses: [],
    exchangeRates: {},
    profile: { ...st().profile, defaultCarryPocketId: undefined },
    settings: { ...st().settings, baseCurrency: 'EGP', showAllCurrenciesInForms: false, secondaryCurrency: null, showSecondaryCurrency: false },
  })
})

describe('list_savings and get_net_worth', () => {
  it('lists pockets with refs, native balance and base value for foreign ones', () => {
    useFinanceStore.setState({ exchangeRates: { USD_EGP: 50 }, savingsAccounts: [account(A1), account(A3, { name: 'Dollars', currency: 'USD', currentBalance: 100 })] })
    const r = read('list_savings') as { total_savings: number; pockets: Record<string, unknown>[] }
    expect(r.total_savings).toBe(6000)
    expect(r.pockets[0]).toMatchObject({ name: 'Dollars', bal: 100, ccy: 'USD', value: 5000, ref: refOf(A3) })
    expect(r.pockets[1]).toMatchObject({ name: 'CIB', bal: 1000 })
    expect(r.pockets[1].value).toBeUndefined()
  })

  it('values priced assets, nulls unpriced ones and flags the total incomplete', () => {
    useAssetPricesStore.setState({ prices: Object.fromEntries([price('XAU_21K', 'EGP', 4000)]) })
    useFinanceStore.setState({ investmentHoldings: [holding(H1), holding(H2, { assetType: 'crypto', name: 'Bitcoin', symbol: 'BTC', quantity: 1 })] })
    const r = read('list_savings') as { total_savings: number; incomplete?: boolean; assets: Record<string, unknown>[] }
    expect(r.assets[0]).toMatchObject({ name: '21k gold', kind: 'gold', qty: 10, karat: 21, value: 40000 })
    expect(r.assets[1]).toMatchObject({ name: 'Bitcoin', value: null })
    expect(r.incomplete).toBe(true)
    expect(r.total_savings).toBe(41200)
  })

  it('computes net worth with the app model: savings + investments + flow - debt', () => {
    useAssetPricesStore.setState({ prices: Object.fromEntries([price('XAU_21K', 'EGP', 4000)]) })
    useFinanceStore.setState({ investmentHoldings: [holding(H1)] })
    expect(read('get_net_worth')).toMatchObject({ currency: 'EGP', net_worth: 41200, savings: 1200, investments: 40000, debt: 0, month_flow: 0 })
  })

  it('caps long lists', () => {
    useFinanceStore.setState({ savingsAccounts: Array.from({ length: 17 }, (_, i) => account(`${i.toString(16).padStart(2, '0')}${'a'.repeat(6)}-0000-0000-0000-000000000000`, { name: `P${i}` })) })
    const r = read('list_savings') as { pockets: unknown[]; more_pockets?: number }
    expect(r.pockets).toHaveLength(15)
    expect(r.more_pockets).toBe(2)
  })
})

describe('add_savings_account', () => {
  it('creates a pocket with the kind icon and an opening balance, and undoes', () => {
    const add = write('add_savings_account')
    const p = add.propose({ name: 'Emergency', kind: 'wallet', balance: 300 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(st().savingsAccounts).toHaveLength(2)
    const applied = add.apply(p.proposal, ctx)
    const created = st().savingsAccounts.find((a) => a.name === 'Emergency')!
    expect(created).toMatchObject({ type: 'bank', category: 'savings', currency: 'EGP', currentBalance: 300, icon: 'Wallet' })
    expect(st().savingsTransactions.at(-1)).toMatchObject({ accountId: created.id, notes: 'Opening balance', isCashFlow: false })
    if (applied.ok) applied.undo?.()
    expect(st().savingsAccounts).toHaveLength(2)
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('validates name, kind, currency and balance, and warns on duplicates', () => {
    const add = write('add_savings_account')
    expect(add.propose({ name: '', kind: 'bank' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', kind: 'gold' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', kind: 'bank', currency: 'USD' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', kind: 'bank', balance: -5 }, ctx).ok).toBe(false)
    const dup = add.propose({ name: 'cib', kind: 'bank' }, ctxAr)
    expect(dup.ok && dup.proposal.preview.effect).toContain('بالفعل')
  })
})

describe('deposit_to_savings', () => {
  it('allocates by default (counts against left to spend) and undoes', () => {
    const dep = write('deposit_to_savings')
    const p = dep.propose({ pocket: 'cib', amount: 250 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.args.mode).toBe('allocate')
    expect(p.proposal.preview.effect).toMatch(/Left to spend drops/)
    expect(bal(A1)).toBe(1000)
    const applied = dep.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(bal(A1)).toBe(1250)
    expect(st().savingsTransactions.at(-1)?.isCashFlow).toBeUndefined()
    if (applied.ok) applied.undo?.()
    expect(bal(A1)).toBe(1000)
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('declare mode only raises net worth', () => {
    const dep = write('deposit_to_savings')
    const p = dep.propose({ pocket: refOf(A1), amount: 250, mode: 'declare' }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/Net worth rises/)
    if (p.ok) dep.apply(p.proposal, ctx)
    expect(st().savingsTransactions.at(-1)?.isCashFlow).toBe(false)
  })

  it('reopens a goal that the deposit auto-achieved when undone', () => {
    useFinanceStore.setState({ goals: [goal()] })
    const dep = write('deposit_to_savings')
    const p = dep.propose({ pocket: 'CIB', amount: 600 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/goals: Car/)
    if (!p.ok) return
    const applied = dep.apply(p.proposal, ctx)
    expect(st().goals[0].status).toBe('achieved')
    if (applied.ok) applied.undo?.()
    expect(st().goals[0]).toMatchObject({ status: 'active', achievedAt: null })
  })

  it('converts a foreign amount and refuses a currency with no path or not enabled', () => {
    const dep = write('deposit_to_savings')
    expect(dep.propose({ pocket: 'CIB', amount: 2, currency: 'USD' }, ctx).ok).toBe(false)
    useFinanceStore.setState({ exchangeRates: { USD_EGP: 50 }, settings: { ...st().settings, showAllCurrenciesInForms: true } })
    const p = dep.propose({ pocket: 'CIB', amount: 2, currency: 'USD' }, ctx)
    expect(p.ok && p.proposal.preview.rows.find((r) => r.label === 'Arrives as')?.value).toMatch(/100/)
    if (p.ok) dep.apply(p.proposal, ctx)
    expect(bal(A1)).toBe(1100)
    expect(dep.propose({ pocket: 'CIB', amount: 2, currency: 'KWD' }, ctx).ok).toBe(false)
    expect(dep.propose({ pocket: 'CIB', amount: 2, currency: 'ZZZ' }, ctx).ok).toBe(false)
  })

  it('never guesses the pocket: unknown and duplicate names return choices', () => {
    const dep = write('deposit_to_savings')
    const none = dep.propose({ pocket: 'Savings', amount: 5 }, ctx)
    expect(none.ok).toBe(false)
    if (!none.ok) expect(none.choices?.map((c) => c.label)).toEqual(['CIB', 'Cash'])
    useFinanceStore.setState({ savingsAccounts: [account(A1), account(A2)] })
    const many = dep.propose({ pocket: 'CIB', amount: 5 }, ctx)
    expect(many.ok).toBe(false)
    if (!many.ok) expect(many.choices).toHaveLength(2)
    expect(dep.propose({ amount: 5 }, ctx).ok).toBe(false)
  })

  it('rejects bad amounts and modes, and a stale proposal', () => {
    const dep = write('deposit_to_savings')
    expect(dep.propose({ pocket: 'CIB', amount: 0 }, ctx).ok).toBe(false)
    expect(dep.propose({ pocket: 'CIB', amount: 5, mode: 'x' }, ctx).ok).toBe(false)
    const p = dep.propose({ pocket: 'CIB', amount: 5 }, ctx)
    useFinanceStore.setState({ savingsAccounts: [account(A2)] })
    expect(p.ok && dep.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('withdraw_from_savings', () => {
  it('income creates an income event; undo removes it and the ledger row', () => {
    const wd = write('withdraw_from_savings')
    const p = wd.propose({ pocket: 'CIB', amount: 400, purpose: 'income' }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/Adds .* to this month/)
    if (!p.ok) return
    const applied = wd.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(bal(A1)).toBe(600)
    expect(st().incomeEvents).toHaveLength(1)
    expect(st().incomeEvents[0]).toMatchObject({ amount: 400, linkedSavingsAccountId: A1, sourceType: 'savings' })
    if (applied.ok) applied.undo?.()
    expect(bal(A1)).toBe(1000)
    expect(st().incomeEvents).toHaveLength(0)
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('spend takes the money out without recording income', () => {
    const wd = write('withdraw_from_savings')
    const p = wd.propose({ pocket: 'CIB', amount: 400, purpose: 'spend' }, ctx)
    if (p.ok) wd.apply(p.proposal, ctx)
    expect(bal(A1)).toBe(600)
    expect(st().incomeEvents).toHaveLength(0)
  })

  it('requires an explicit supported purpose and points debt and transfer elsewhere', () => {
    const wd = write('withdraw_from_savings')
    expect(wd.propose({ pocket: 'CIB', amount: 5 }, ctx).ok).toBe(false)
    const debt = wd.propose({ pocket: 'CIB', amount: 5, purpose: 'debt' }, ctx)
    expect(!debt.ok && debt.error).toMatch(/not available/)
    const move = wd.propose({ pocket: 'CIB', amount: 5, purpose: 'transfer' }, ctx)
    expect(!move.ok && move.hint).toMatch(/transfer_between_pockets/)
  })

  it('refuses more than the balance and rechecks on apply', () => {
    const wd = write('withdraw_from_savings')
    expect(wd.propose({ pocket: 'CIB', amount: 1001, purpose: 'spend' }, ctx).ok).toBe(false)
    const p = wd.propose({ pocket: 'CIB', amount: 900, purpose: 'spend' }, ctx)
    useFinanceStore.setState({ savingsAccounts: [account(A1, { currentBalance: 100 })] })
    expect(p.ok && wd.apply(p.proposal, ctx).ok).toBe(false)
    expect(bal(A1)).toBe(100)
  })
})

describe('transfer_between_pockets', () => {
  it('moves money as two non-cash-flow legs and undoes', () => {
    const tr = write('transfer_between_pockets')
    const p = tr.propose({ from: 'CIB', to: 'Cash', amount: 300 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/do not change/)
    if (!p.ok) return
    const applied = tr.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect([bal(A1), bal(A2)]).toEqual([700, 500])
    const legs = st().savingsTransactions
    expect(legs).toHaveLength(2)
    expect(legs[0].transferGroupId).toBe(legs[1].transferGroupId)
    expect(legs.every((t) => t.isCashFlow === false)).toBe(true)
    if (applied.ok) applied.undo?.()
    expect([bal(A1), bal(A2)]).toEqual([1000, 200])
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('F9: accepts a fiat to gold move at the gram quote', () => {
    useFinanceStore.setState({ goldPricePerGram: 4000, goldPriceAvailable: true, savingsAccounts: [account(A1), account(A3, { name: 'Gold', type: 'vault', currency: 'XAU', currentBalance: 0 })] })
    const p = write('transfer_between_pockets').propose({ from: 'CIB', to: 'Gold', amount: 400 }, ctx)
    expect(p.ok).toBe(true)
    useFinanceStore.setState({ goldPriceAvailable: false })
    expect(write('transfer_between_pockets').propose({ from: 'CIB', to: 'Gold', amount: 400 }, ctx).ok).toBe(false)
  })

  it('converts into a foreign pocket and names the affected goals', () => {
    useFinanceStore.setState({ exchangeRates: { USD_EGP: 50 }, savingsAccounts: [account(A1), account(A3, { name: 'Dollars', currency: 'USD', currentBalance: 0 })], goals: [goal()] })
    const tr = write('transfer_between_pockets')
    const p = tr.propose({ from: 'CIB', to: 'Dollars', amount: 500 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/goals: Car/)
    if (p.ok) tr.apply(p.proposal, ctx)
    expect([bal(A1), bal(A3)]).toEqual([500, 10])
  })

  it('rejects the same pocket, insufficient funds and a move with no FX path', () => {
    const tr = write('transfer_between_pockets')
    expect(tr.propose({ from: 'CIB', to: 'CIB', amount: 5 }, ctx).ok).toBe(false)
    expect(tr.propose({ from: 'CIB', to: 'Cash', amount: 5000 }, ctx).ok).toBe(false)
    useFinanceStore.setState({ savingsAccounts: [account(A1), account(A3, { name: 'Gold', type: 'gold', category: 'investment', currency: 'XAU', currentBalance: 1 })] })
    const noPath = tr.propose({ from: 'CIB', to: 'Gold', amount: 100 }, ctx)
    expect(!noPath.ok && noPath.error).toMatch(/no exchange path/i)
    expect(tr.propose({ from: 'Nope', to: 'Gold', amount: 100 }, ctx).ok).toBe(false)
  })
})

describe('correct_savings_balance', () => {
  it('posts a non-cash correction and undoes', () => {
    const fix = write('correct_savings_balance')
    const p = fix.propose({ pocket: 'CIB', balance: 1500 }, ctx)
    expect(p.ok && p.proposal.preview.rows[0]).toMatchObject({ label: 'Balance' })
    if (!p.ok) return
    const applied = fix.apply(p.proposal, ctx)
    expect(bal(A1)).toBe(1500)
    expect(st().savingsTransactions.at(-1)).toMatchObject({ type: 'deposit', amount: 500, isCashFlow: false })
    if (applied.ok) applied.undo?.()
    expect(bal(A1)).toBe(1000)
    expect(st().savingsTransactions).toHaveLength(0)
  })

  it('records a downward correction as a withdrawal and rejects no-ops and negatives', () => {
    const fix = write('correct_savings_balance')
    const p = fix.propose({ pocket: 'CIB', balance: 400 }, ctx)
    if (p.ok) fix.apply(p.proposal, ctx)
    expect(st().savingsTransactions.at(-1)).toMatchObject({ type: 'withdrawal', amount: 600 })
    expect(fix.propose({ pocket: 'CIB', balance: 400 }, ctx).ok).toBe(false)
    expect(fix.propose({ pocket: 'CIB', balance: -1 }, ctx).ok).toBe(false)
  })
})

describe('delete_savings_account', () => {
  it('is strong, cascades the ledger, schedules and goal links, and undoes it all with the same ids', () => {
    useFinanceStore.setState({
      goals: [goal()],
      savingsTransactions: [{ id: 't1', accountId: A1, type: 'deposit', amount: 1000, currency: 'EGP', date: '2026-10-01' }, { id: 't2', accountId: A2, type: 'deposit', amount: 200, currency: 'EGP', date: '2026-10-01' }],
      recurringSavingsDeposits: [{ id: 'r1', accountId: A1, amount: 100, currency: 'EGP', frequency: 'monthly', dayOfMonth: 1, nextDueDate: '2026-11-01', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }],
    })
    const pre = structuredClone({
      savingsAccounts: st().savingsAccounts,
      savingsTransactions: st().savingsTransactions,
      recurringSavingsDeposits: st().recurringSavingsDeposits,
      goals: st().goals,
    })
    const del = write('delete_savings_account')
    const p = del.propose({ pocket: 'CIB' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('strong')
    expect(p.proposal.preview.effect).toMatch(/1 ledger entries[\s\S]*Net worth drops by[\s\S]*Unlinked from goals: Car/)
    const applied = del.apply(p.proposal, ctx)
    expect(st().savingsAccounts.map((a) => a.id)).toEqual([A2])
    expect(st().savingsTransactions.map((t) => t.id)).toEqual(['t2'])
    expect(st().recurringSavingsDeposits).toHaveLength(0)
    expect(st().goals[0].linkedSavingsAccountIds).toEqual([])
    if (!applied.ok) return
    applied.undo?.()
    expect(st().savingsAccounts).toEqual(pre.savingsAccounts)
    expect(st().savingsTransactions).toEqual(pre.savingsTransactions)
    expect(st().recurringSavingsDeposits).toEqual(pre.recurringSavingsDeposits)
    expect(st().goals).toEqual(pre.goals)
  })

  it('undo keeps a ledger row added to another pocket after the delete', () => {
    useFinanceStore.setState({ goals: [goal()] })
    const del = write('delete_savings_account')
    const p = del.propose({ pocket: 'CIB' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = del.apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    const later = { id: 't9', accountId: A2, type: 'deposit', amount: 5, currency: 'EGP', date: '2026-10-02' } as never
    useFinanceStore.setState({ savingsTransactions: [later] })
    applied.undo?.()
    expect(st().savingsAccounts.map((a) => a.id).sort()).toEqual([A1, A2].sort())
    expect(st().savingsTransactions.map((t) => t.id)).toEqual(['t9'])
    expect(st().goals[0].linkedSavingsAccountIds).toEqual([A1])
  })

  it('undo links a deposit income row back to the pocket it deposited into', () => {
    useFinanceStore.setState({
      incomeEvents: [{ id: 'inc1', name: 'Salary', amount: 5, currency: 'EGP', sourceType: 'salary', receivedDate: '2026-10-01', status: 'confirmed', linkedSavingsAccountId: A1, createdAt: '', updatedAt: '' } as never],
    })
    const del = write('delete_savings_account')
    const p = del.propose({ pocket: 'CIB' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = del.apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    expect(st().incomeEvents[0].linkedSavingsAccountId).toBeUndefined()
    applied.undo?.()
    expect(st().incomeEvents[0].linkedSavingsAccountId).toBe(A1)
  })

  it('refuses the default carry pocket', () => {
    useFinanceStore.setState({ profile: { ...st().profile, defaultCarryPocketId: A1 } })
    expect(write('delete_savings_account').propose({ pocket: 'CIB' }, ctx).ok).toBe(false)
  })

  it('rejects a stale delete', () => {
    const del = write('delete_savings_account')
    const p = del.propose({ pocket: 'CIB' }, ctx)
    useFinanceStore.setState({ savingsAccounts: [] })
    expect(p.ok && del.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('investment holdings', () => {
  it('adds gold in pounds as grams with a per-gram cost, and undoes', () => {
    useAssetPricesStore.setState({ prices: Object.fromEntries([price('XAU_21K', 'EGP', 4000)]) })
    const add = write('add_investment_holding')
    const p = add.propose({ type: 'gold', karat: '21', quantity: 2, unit: 'pounds', paid: 60000 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.effect).toMatch(/Worth about/)
    const applied = add.apply(p.proposal, ctx)
    expect(st().investmentHoldings[0]).toMatchObject({ assetType: 'gold', name: '21k gold', karat: 21, quantity: 16, goldUnit: 'pounds', currency: 'EGP', unitCost: 3750, costBasisCurrency: 'EGP' })
    if (applied.ok) applied.undo?.()
    expect(st().investmentHoldings).toHaveLength(0)
  })

  it('adds crypto, stock and property with the sheet payloads and flags unpriced ones', () => {
    const add = write('add_investment_holding')
    const crypto = add.propose({ type: 'crypto', symbol: 'btc', quantity: 0.5 }, ctx)
    expect(crypto.ok && crypto.proposal.preview.effect).toMatch(/No live price/)
    if (crypto.ok) add.apply(crypto.proposal, ctx)
    const stock = add.propose({ type: 'stock', symbol: 'aapl', quantity: 3 }, ctx)
    if (stock.ok) add.apply(stock.proposal, ctx)
    const property = add.propose({ type: 'property', value: 2_000_000, size: 90, name: 'Flat' }, ctx)
    expect(property.ok && property.proposal.preview.effect).toMatch(/Worth about/)
    if (property.ok) add.apply(property.proposal, ctx)
    expect(st().investmentHoldings).toMatchObject([
      { assetType: 'crypto', name: 'BTC', symbol: 'BTC', quantity: 0.5, currency: 'EGP' },
      { assetType: 'stock', name: 'AAPL', symbol: 'AAPL', quantity: 3, currency: 'USD' },
      { assetType: 'property', name: 'Flat', quantity: 90, propertyValue: 2_000_000, sharePercent: 100 },
    ])
  })

  it('does not guess a karat, symbol or worth', () => {
    const add = write('add_investment_holding')
    expect(add.propose({ type: 'gold', quantity: 5 }, ctx).ok).toBe(false)
    expect(add.propose({ type: 'gold', quantity: 5, karat: '23' }, ctx).ok).toBe(false)
    expect(add.propose({ type: 'crypto', quantity: 5 }, ctx).ok).toBe(false)
    expect(add.propose({ type: 'stock', quantity: 0, symbol: 'X' }, ctx).ok).toBe(false)
    expect(add.propose({ type: 'property' }, ctx).ok).toBe(false)
    expect(add.propose({ type: 'bond', quantity: 1 }, ctx).ok).toBe(false)
    expect(add.propose({ type: 'gold', quantity: 5, karat: '21', date: '2026-13-01' }, ctx).ok).toBe(false)
  })

  it('updates quantity and undoes, and keeps property and non-property fields apart', () => {
    useFinanceStore.setState({ investmentHoldings: [holding(H1, { goldUnit: 'pounds' }), holding(H2, { assetType: 'property', name: 'Flat', propertyValue: 1_000_000, quantity: 80 })] })
    const upd = write('update_investment_holding')
    const p = upd.propose({ asset: '21k gold', quantity: 25 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const applied = upd.apply(p.proposal, ctx)
    expect(st().investmentHoldings[0]).toMatchObject({ quantity: 25, goldUnit: 'grams' })
    if (applied.ok) applied.undo?.()
    expect(st().investmentHoldings[0]).toMatchObject({ quantity: 10, goldUnit: 'pounds' })

    const worth = upd.propose({ asset: 'Flat', value: 1_200_000 }, ctx)
    if (worth.ok) upd.apply(worth.proposal, ctx)
    expect(st().investmentHoldings[1].propertyValue).toBe(1_200_000)
    expect(upd.propose({ asset: 'Flat', quantity: 5 }, ctx).ok).toBe(false)
    expect(upd.propose({ asset: '21k gold', value: 5 }, ctx).ok).toBe(false)
    expect(upd.propose({ asset: '21k gold', quantity: 25 }, ctx).ok).toBe(true)
    expect(upd.propose({ asset: '21k gold' }, ctx).ok).toBe(false)
    expect(upd.propose({ asset: 'Silver', quantity: 1 }, ctx).ok).toBe(false)
  })

  it('deletes with strong risk, undoes with the same id, and rejects a stale proposal', () => {
    useFinanceStore.setState({ investmentHoldings: [holding(H1)] })
    const del = write('delete_investment_holding')
    const p = del.propose({ asset: '21k gold' }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    if (!p.ok) return
    useFinanceStore.setState({ investmentHoldings: [] })
    expect(del.apply(p.proposal, ctx).ok).toBe(false)
    useFinanceStore.setState({ investmentHoldings: [holding(H1)] })
    const applied = del.apply(p.proposal, ctx)
    expect(st().investmentHoldings).toHaveLength(0)
    if (!applied.ok) return
    applied.undo?.()
    expect(st().investmentHoldings).toEqual([holding(H1)])
  })
})

describe('audit fixes', () => {
  const setBase = (base: string, rates: Record<string, number>) =>
    useFinanceStore.setState({ exchangeRates: rates, settings: { ...useFinanceStore.getState().settings, baseCurrency: base as never } })

  it('stores a property worth in EGP for a non-EGP base and says so', () => {
    setBase('USD', { USD_EGP: 50, EGP_USD: 0.02 })
    const p = write('add_investment_holding').propose({ type: 'property', name: 'Flat', value: 1000 }, ctx)
    if (!p.ok) throw new Error('propose failed')
    expect(p.proposal.preview.rows.find((r) => r.label === 'Value')?.value).toMatch(/=/)
    expect(write('add_investment_holding').apply(p.proposal, ctx).ok).toBe(true)
    expect(useFinanceStore.getState().investmentHoldings[0]).toMatchObject({ propertyValue: 50000, currency: 'EGP' })
  })

  it('refuses a property when base is not EGP and no rate exists', () => {
    setBase('KWD', {})
    expect(write('add_investment_holding').propose({ type: 'property', value: 1000 }, ctx)).toMatchObject({ ok: false })
  })

  it('a second identical add_investment_holding approval does not double-create', () => {
    const args = { type: 'property', name: 'Flat', value: 1000 }
    const a = write('add_investment_holding').propose(args, ctx)
    const b = write('add_investment_holding').propose(args, ctx)
    if (!a.ok || !b.ok) throw new Error('propose failed')
    expect(write('add_investment_holding').apply(a.proposal, ctx).ok).toBe(true)
    expect(write('add_investment_holding').apply(b.proposal, ctx)).toMatchObject({ ok: false, error: 'Already added' })
    expect(useFinanceStore.getState().investmentHoldings).toHaveLength(1)
  })
})
