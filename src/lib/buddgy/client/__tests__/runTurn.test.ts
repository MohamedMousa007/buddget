import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TurnEvent } from '@/lib/buddgy/protocol'

const apiFetchAuth = vi.fn()
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: (...a: unknown[]) => apiFetchAuth(...a) }))

import { TURN_LIMITS } from '@/lib/buddgy/protocol'
import { executeCalls, runTurn, TurnFailure } from '@/lib/buddgy/client/runTurn'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { resetAutoSlots } from '@/lib/buddgy/tools/autoApplyGuard'
import { resetSameTurnMemory } from '@/lib/buddgy/tools/exec/expenses'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const sse = (events: TurnEvent[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } })

const meta: TurnEvent = { t: 'meta', chatId: '11111111-1111-1111-1111-111111111111', newChat: true, rolled: false, soft: false, tier: 'fast' }
const done: TurnEvent = { t: 'done', units: 0, finish: 'STOP', truncated: false }

const base = { text: 'hi', history: [], chatId: null, locale: 'en' as const, intent: 'answer' as const, route: '/' }

beforeEach(() => {
  apiFetchAuth.mockReset()
  useFinanceStore.setState({
    expenses: [],
    paymentMethods: [{ id: 'a1a1a1a1-0000-0000-0000-000000000001', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true } as never],
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('runTurn', () => {
  it('streams text and returns the chat id', async () => {
    apiFetchAuth.mockResolvedValueOnce(sse([meta, { t: 'text', d: 'Hel' }, { t: 'text', d: 'lo' }, done]))
    const seen: string[] = []
    const out = await runTurn({ ...base, onText: (t) => seen.push(t) })
    expect(seen).toEqual(['Hel', 'Hello'])
    expect(out).toMatchObject({ text: 'Hello', chatId: meta.t === 'meta' ? meta.chatId : null, proposals: [] })
    expect(apiFetchAuth).toHaveBeenCalledTimes(1)
  })

  it('ends the turn after a proposal-only batch without another hop', async () => {
    apiFetchAuth.mockResolvedValueOnce(
      sse([
        meta,
        { t: 'text', d: 'Adding it.' },
        { t: 'calls', parts: [{ functionCall: { name: 'add_expense', args: {} } }], calls: [{ name: 'add_expense', args: { description: 'Coffee', amount: 45, category: 'Food' } }] },
        done,
      ]),
    )
    const out = await runTurn({ ...base, text: 'coffee 45', intent: 'action', onText: () => undefined })
    expect(apiFetchAuth).toHaveBeenCalledTimes(1)
    expect(out.proposals).toHaveLength(1)
    expect(out.text).toBe('Adding it.')
  })

  it('goes back to the model with read results and drops the lead-in text', async () => {
    apiFetchAuth
      .mockResolvedValueOnce(
        sse([meta, { t: 'text', d: 'Let me check.' }, { t: 'calls', parts: [{ functionCall: { name: 'get_summary', args: {} } }], calls: [{ name: 'get_summary', args: {} }] }, done]),
      )
      .mockResolvedValueOnce(sse([{ ...meta, newChat: false }, { t: 'text', d: 'You spent 0.' }, done]))
    const seen: string[] = []
    const out = await runTurn({ ...base, onText: (t) => seen.push(t) })
    expect(apiFetchAuth).toHaveBeenCalledTimes(2)
    const second = JSON.parse((apiFetchAuth.mock.calls[1][1] as { body: string }).body)
    expect(second.hop).toBe(true)
    expect(second.messages.at(-1)).toMatchObject({ role: 'tool', results: [{ name: 'get_summary' }] })
    expect(out.text).toBe('You spent 0.')
    expect(out.reads.map((r) => r.tool)).toEqual(['get_summary'])
    expect(seen).toContain('')
  })

  it('keeps proposals gathered in an earlier hop when a later hop fails', async () => {
    apiFetchAuth
      .mockResolvedValueOnce(
        sse([
          meta,
          {
            t: 'calls',
            parts: [{ functionCall: { name: 'add_expense', args: {} } }, { functionCall: { name: 'get_summary', args: {} } }],
            calls: [
              { name: 'add_expense', args: { description: 'Coffee', amount: 45, category: 'Food' } },
              { name: 'get_summary', args: {} },
            ],
          },
          done,
        ]),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ layer: 'window_5h' }), { status: 429 }))
    const out = await runTurn({ ...base, text: 'coffee 45', intent: 'action', onText: () => undefined })
    expect(out.proposals).toHaveLength(1)
    expect(out.truncated).toBe(true)
  })

  it('maps quota, auth and offline failures', async () => {
    apiFetchAuth.mockResolvedValueOnce(new Response(JSON.stringify({ layer: 'window_5h', resetAt: '2026-10-19T18:00:00Z' }), { status: 429 }))
    await expect(runTurn({ ...base, onText: () => undefined })).rejects.toMatchObject({ detail: { kind: 'quota', layer: 'window_5h' } })
    apiFetchAuth.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(runTurn({ ...base, onText: () => undefined })).rejects.toMatchObject({ detail: { kind: 'unauthorized' } })
    apiFetchAuth.mockResolvedValueOnce(sse([meta, { t: 'error', code: 'blocked' }]))
    await expect(runTurn({ ...base, onText: () => undefined })).rejects.toBeInstanceOf(TurnFailure)
  })
})

describe('executeCalls', () => {
  const ctx = { now: new Date('2026-10-19T12:00:00'), locale: 'en' as const }

  it('reports unknown tools and failed proposals to the model', () => {
    const r = executeCalls([{ name: 'nope', args: {} }, { name: 'add_expense', args: { description: 'x', amount: -1, category: 'Food' } }], ctx)
    expect(r.needsModel).toBe(true)
    expect(r.proposals).toEqual([])
    expect(r.results[0].response).toEqual({ error: 'unknown_tool' })
    expect(r.results[1].response).toMatchObject({ error: expect.any(String) })
  })

  it('tells the model a proposal is pending, never done', () => {
    const r = executeCalls([{ name: 'add_expense', args: { description: 'Coffee', amount: 45, category: 'Food' } }], ctx)
    expect(r.needsModel).toBe(false)
    expect(r.results[0].response).toMatchObject({ status: 'pending_user_approval' })
  })

  it('shrinks each read result so several large ones stay under the request cap', () => {
    const big = { rows: 'x'.repeat(9000) }
    const read = TOOLS.get('search_expenses')!
    const spy = vi.spyOn(read, 'read').mockReturnValue(big)
    const calls = Array.from({ length: 5 }, () => ({ name: 'search_expenses', args: {} }))
    const r = executeCalls(calls, ctx, 2000)
    spy.mockRestore()
    const total = r.results.reduce((n, x) => n + JSON.stringify(x.response).length, 0)
    expect(total).toBeLessThan(TURN_LIMITS.maxTotalChars / 2)
  })

  it('BAI-3: with Hide balances: Buddgy on, get_summary leaves no income, spent or left-to-spend figure', () => {
    const hidden = useFinanceStore.getState().settings
    useFinanceStore.setState({ settings: { ...hidden, privacy: { preset: 'custom', buddgy: true } as never } })
    const r = executeCalls([{ name: 'get_summary', args: {} }], ctx)
    useFinanceStore.setState({ settings: hidden })
    const res = r.results[0].response as Record<string, unknown>
    for (const k of ['income', 'spent', 'budget', 'net_cash_flow', 'safe_daily', 'projected_spend']) expect(typeof res[k]).not.toBe('number')
  })
})

describe('BAI-7 / BAI-10 read taint', () => {
  const addCall = (amount = 45): TurnEvent[] => [
    meta,
    { t: 'calls', parts: [{ functionCall: { name: 'add_expense', args: {} } }], calls: [{ name: 'add_expense', args: { description: 'Coffee', amount, category: 'Food' } }] },
    done,
  ]

  it('a chat that already ran a read never auto-applies a later add', async () => {
    useFinanceStore.setState({ incomeSources: [{ id: 'i1', name: 'Salary', amount: 1000000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 1, paydayDays: [1], sourceType: 'salary', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as never], incomeEvents: [], budgetPlans: [], activeBudgetPlanId: null, exchangeRates: {} })
    resetAutoSlots()
    resetSameTurnMemory()
    apiFetchAuth.mockResolvedValueOnce(sse(addCall()))
    const fresh = await runTurn({ ...base, text: 'coffee 45', intent: 'action', now: new Date('2026-10-19T12:00:00'), onText: () => undefined })
    expect(fresh.proposals[0].risk).toBe('auto')
    apiFetchAuth.mockResolvedValueOnce(sse(addCall(46)))
    const tainted = await runTurn({ ...base, text: 'coffee 46', intent: 'action', tainted: true, now: new Date('2026-10-19T12:00:00'), onText: () => undefined })
    expect(tainted.proposals[0].risk).toBe('approve')
  })

  it('navigation with a prefill does not auto-run after a read, even with consent', async () => {
    const { grantNavConsent, resetNavConsent } = await import('@/lib/buddgy/tools/navConsent')
    grantNavConsent()
    try {
      const call = [{ name: 'open_sheet', args: { sheet: 'add_expense', amount: 99 } }]
      const afterRead = executeCalls(call, { now: new Date(), locale: 'en', afterRead: true })
      expect(afterRead.proposals).toHaveLength(1)
      const direct = executeCalls(call, { now: new Date(), locale: 'en' })
      expect(direct.proposals).toHaveLength(0)
    } finally {
      resetNavConsent()
    }
  })
})
