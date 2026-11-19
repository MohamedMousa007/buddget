import { beforeAll, describe, expect, it, vi } from 'vitest'
import { applyDelta, hasChangesSince, pullDelta, type MappedDelta } from './delta'
import { emptySnapshot, type Snapshot } from './snapshot'
import { readSyncCursor, writeSyncCursor, clearSyncCursors } from './cursor'

const exp = (id: string, updatedAt: string, amount = 10) => ({ id, updatedAt, createdAt: updatedAt, amount }) as never

function noDelta(over: Partial<MappedDelta> = {}): MappedDelta {
  const none = { upserts: [], deletedIds: [] }
  return {
    cursor: '2026-10-20T10:00:00Z', profile: null, settings: null,
    paymentMethods: none, incomeSources: none, incomeEvents: none, expenses: none, receipts: none, recurringExpenses: none,
    subscriptions: none, debts: none, debtPayments: none, recurringDebtPayments: none, savingsAccounts: none, investmentHoldings: none,
    savingsTransactions: none, recurringSavingsDeposits: none, goals: none, buddgyMemories: none, accountAdjustments: none,
    budgetPlans: [], deletedBudgetPlanIds: [], budgetPlanActivations: [], deletedBudgetPlanActivationIds: [], staleBefore: null,
    ...over,
  }
}

const withExpenses = (rows: unknown[]): Snapshot => ({ ...emptySnapshot(), expenses: rows as Snapshot['expenses'] })

describe('applyDelta', () => {
  it('changes nothing when nothing changed on the server', () => {
    const local = withExpenses([exp('a', '2026-10-01T00:00:00Z')])
    const out = applyDelta(local, noDelta())
    expect(out.expenses).toHaveLength(1)
    expect(out.profile).toBe(local.profile)
    expect(out.settings).toBe(local.settings)
  })

  it('adds new rows and takes the server copy when it is newer', () => {
    const local = withExpenses([exp('a', '2026-10-01T00:00:00Z', 10)])
    const out = applyDelta(local, noDelta({ expenses: { upserts: [exp('a', '2026-10-05T00:00:00Z', 99), exp('b', '2026-10-05T00:00:00Z')], deletedIds: [] } }))
    expect(out.expenses.map((e) => e.id).sort()).toEqual(['a', 'b'])
    expect(out.expenses.find((e) => e.id === 'a')).toMatchObject({ amount: 99 })
  })

  it('keeps a local edit that is newer than the server copy', () => {
    const local = withExpenses([exp('a', '2026-10-09T00:00:00Z', 55)])
    const out = applyDelta(local, noDelta({ expenses: { upserts: [exp('a', '2026-10-05T00:00:00Z', 10)], deletedIds: [] } }))
    expect(out.expenses[0]).toMatchObject({ amount: 55 })
  })

  it('removes rows another device deleted, and leaves the rest', () => {
    const local = withExpenses([exp('a', '2026-10-01T00:00:00Z'), exp('b', '2026-10-01T00:00:00Z')])
    const out = applyDelta(local, noDelta({ expenses: { upserts: [], deletedIds: ['a'] } }))
    expect(out.expenses.map((e) => e.id)).toEqual(['b'])
  })

  it('drops activations of budget plans that were deleted on the server', () => {
    const act = (id: string, planId: string) => ({ id, planId, effectiveFrom: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' }) as never
    const local = { ...emptySnapshot(), budgetPlanActivations: [act('a1', 'p1'), act('a2', 'p2')] as Snapshot['budgetPlanActivations'] }
    const out = applyDelta(local, noDelta({ deletedBudgetPlanIds: ['p1'] }))
    expect(out.budgetPlanActivations.map((a) => a.id)).toEqual(['a2'])
  })

  it('drops an activation another device tombstoned (SYN9) and keeps the others', () => {
    const act = (id: string, planId: string) => ({ id, planId, effectiveFrom: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' }) as never
    const local = { ...emptySnapshot(), budgetPlanActivations: [act('a1', 'p1'), act('a2', 'p1')] as Snapshot['budgetPlanActivations'] }
    const out = applyDelta(local, noDelta({ deletedBudgetPlanActivationIds: ['a1'] }))
    expect(out.budgetPlanActivations.map((a) => a.id)).toEqual(['a2'])
  })

  it('pullDelta reads the deleted activation ids from sync_pull', async () => {
    const payload = { cursor: 'c', has_profile: true, profile: null, settings: null, lists: {}, budget_plans: [], budget_plans_deleted: [], budget_categories: [], budget_subcategories: [], budget_plan_activations: [], budget_plan_activations_deleted: ['a1'] }
    const out = await pullDelta({ rpc: vi.fn().mockResolvedValue({ data: payload, error: null }) } as never, 'c0')
    expect(out?.deletedBudgetPlanActivationIds).toEqual(['a1'])
  })

  it('removes deleted budget plans and merges the live ones', () => {
    const plan = (id: string) => ({ id, updatedAt: '2026-10-01T00:00:00Z', categories: [] }) as never
    const local = { ...emptySnapshot(), budgetPlans: [plan('p1'), plan('p2')] as Snapshot['budgetPlans'] }
    const out = applyDelta(local, noDelta({ budgetPlans: [plan('p3')], deletedBudgetPlanIds: ['p1'] }))
    expect(out.budgetPlans.map((p) => p.id).sort()).toEqual(['p2', 'p3'])
  })

  it('takes the profile and currencies from the server only when the profile changed', () => {
    const local = emptySnapshot()
    const profile = { profile: { id: 'u1', name: 'Sara', createdAt: 'x' }, extras: { financialGoalsNotes: 'save', activeBudgetPlanId: 'p9', baseCurrency: 'EGP', secondaryCurrency: 'USD' } } as never
    const out = applyDelta(local, noDelta({ profile }))
    expect(out.profile.id).toBe('u1')
    expect(out.settings).toMatchObject({ baseCurrency: 'EGP', secondaryCurrency: 'USD' })
    expect(out.activeBudgetPlanId).toBe('p9')
    expect(out.financialGoalsNotes).toBe('save')
  })
})

describe('applyDelta clears', () => {
  it('takes an emptied goals note and a cleared active plan from a changed server profile', () => {
    const local = { ...emptySnapshot(), financialGoalsNotes: 'save', activeBudgetPlanId: 'p9' }
    const profile = { profile: { id: 'u1', name: 'Sara', createdAt: 'x' }, extras: { financialGoalsNotes: '', activeBudgetPlanId: null, baseCurrency: 'EGP', secondaryCurrency: null } } as never
    const out = applyDelta(local, noDelta({ profile }))
    expect(out.financialGoalsNotes).toBe('')
    expect(out.activeBudgetPlanId).toBeNull()
  })
  it('keeps both when no profile came down', () => {
    const local = { ...emptySnapshot(), financialGoalsNotes: 'save', activeBudgetPlanId: 'p9' }
    const out = applyDelta(local, noDelta())
    expect(out.financialGoalsNotes).toBe('save')
    expect(out.activeBudgetPlanId).toBe('p9')
  })
})

describe('stale cursor (full pull)', () => {
  it('drops local rows the server no longer has that predate the stale cursor, keeps newer unsynced ones', () => {
    const local = withExpenses([exp('old', '2026-06-01T00:00:00Z'), exp('kept', '2026-06-01T00:00:00Z'), exp('offline', '2026-09-01T00:00:00Z')])
    const out = applyDelta(local, noDelta({ staleBefore: '2026-08-01T00:00:00Z', expenses: { upserts: [exp('kept', '2026-06-01T00:00:00Z')], deletedIds: [] } }))
    expect(out.expenses.map((e) => e.id).sort()).toEqual(['kept', 'offline'])
  })

  it('QA-107: a delivered row edited after the stale cursor but gone from the server is dropped; an unsent one is kept', () => {
    const sent = exp('sent', '2026-09-01T00:00:00Z')
    const local = withExpenses([sent, exp('unsent', '2026-09-01T00:00:00Z')])
    const out = applyDelta(local, noDelta({ staleBefore: '2026-08-01T00:00:00Z' }), withExpenses([sent]))
    expect(out.expenses.map((e) => e.id)).toEqual(['unsent'])
  })

  it('compares instants not strings, and never prunes budget plans or unparseable stamps', () => {
    const local = { ...withExpenses([exp('plus', '2026-06-01T00:00:00.000+00:00'), exp('bad', 'not-a-date')]), budgetPlans: [{ id: 'p1', updatedAt: '2026-01-01T00:00:00Z' }] } as unknown as Snapshot
    const out = applyDelta(local, noDelta({ staleBefore: '2026-08-01T00:00:00Z' }))
    expect(out.expenses.map((e) => e.id)).toEqual(['bad'])
    expect(out.budgetPlans).toHaveLength(1)
  })

  it('pullDelta repeats as a full pull when the server says needs_full', async () => {
    const full = { cursor: 'c2', has_profile: true, profile: null, settings: null, lists: {}, budget_plans: [], budget_plans_deleted: [], budget_categories: [], budget_subcategories: [], budget_plan_activations: [] }
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { needs_full: true, cursor: 'c1' }, error: null })
      .mockResolvedValueOnce({ data: full, error: null })
    const out = await pullDelta({ rpc } as never, '2026-01-01T00:00:00Z')
    expect(rpc).toHaveBeenNthCalledWith(1, 'sync_pull_v2', { p_since: '2026-01-01T00:00:00Z' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'sync_pull_v2', {})
    expect(out).toMatchObject({ cursor: 'c2', staleBefore: '2026-01-01T00:00:00Z' })
  })
})

describe('sync cursor', () => {
  beforeAll(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() { return store.size },
      },
    })
  })

  it('is kept per account and store version, and cleared as a set', () => {
    clearSyncCursors()
    expect(readSyncCursor('u1', 21)).toBeNull()
    writeSyncCursor('u1', 21, 'c1')
    writeSyncCursor('u2', 21, 'c2')
    expect(readSyncCursor('u1', 21)).toBe('c1')
    expect(readSyncCursor('u1', 22)).toBeNull()
    clearSyncCursors()
    expect(readSyncCursor('u1', 21)).toBeNull()
    expect(readSyncCursor('u2', 21)).toBeNull()
  })
})

describe('hasChangesSince', () => {
  const client = (result: unknown) => ({ rpc: vi.fn().mockResolvedValue(result) }) as never
  it('is false only when the server explicitly says nothing changed', async () => {
    expect(await hasChangesSince(client({ data: false, error: null }), 'c0')).toBe(false)
  })
  it('is true when the server says something changed, answers null, or errors', async () => {
    expect(await hasChangesSince(client({ data: true, error: null }), 'c0')).toBe(true)
    expect(await hasChangesSince(client({ data: null, error: null }), 'c0')).toBe(true)
    expect(await hasChangesSince(client({ data: false, error: { message: 'down' } }), 'c0')).toBe(true)
  })
  it('is true when the call throws, so the full pull stays the authority', async () => {
    expect(await hasChangesSince({ rpc: vi.fn().mockRejectedValue(new Error('offline')) } as never, 'c0')).toBe(true)
  })
})

describe('QA-19: an undelivered profile or settings edit survives a pull', () => {
  const server = { profile: { id: 'u1', name: 'Sara', createdAt: 'x', onboardingStep: 0 }, extras: { financialGoalsNotes: '', activeBudgetPlanId: null, baseCurrency: 'EGP', secondaryCurrency: null } } as never
  const delivered = { ...emptySnapshot(), profile: { id: 'u1', name: 'Sara', createdAt: 'x', onboardingStep: 0 } } as unknown as Snapshot

  it('keeps a local profile edit the server has not received when an older server profile comes down', () => {
    const local = { ...delivered, profile: { ...delivered.profile, name: 'Sara M', onboardingStep: 2 } } as unknown as Snapshot
    const out = applyDelta(local, noDelta({ profile: server }), delivered)
    expect(out.profile).toBe(local.profile)
  })

  it('still takes the server profile when this device has nothing unsent', () => {
    const out = applyDelta(delivered, noDelta({ profile: { ...(server as object), profile: { id: 'u1', name: 'Other device', createdAt: 'x' } } as never }), delivered)
    expect(out.profile.name).toBe('Other device')
  })

  it('keeps an unsent settings toggle, and takes the server settings otherwise', () => {
    const flipped = delivered.settings.theme === 'dark' ? 'light' : 'dark'
    const serverSettings = { ...delivered.settings, hideAmounts: 'from-server' } as never
    const local = { ...delivered, settings: { ...delivered.settings, theme: flipped } } as unknown as Snapshot
    expect(applyDelta(local, noDelta({ settings: serverSettings }), delivered).settings).toBe(local.settings)
    expect(applyDelta(delivered, noDelta({ settings: serverSettings }), delivered).settings).toMatchObject({ hideAmounts: 'from-server' })
  })
})
