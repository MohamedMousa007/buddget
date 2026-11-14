import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  db: {} as Record<string, Array<Record<string, unknown>>>,
  seq: 0,
  curated: null as null | Record<string, unknown>,
  dispatch: vi.fn(),
  gemini: null as null | Record<string, unknown>,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/sms/resolveSmsUser', () => ({ resolveSmsCaller: async () => ({ userId: 'u1', deviceId: null }) }))
vi.mock('@/lib/sms/deviceGate', () => ({ smsDeviceGate: async () => null }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: async () => false }))
vi.mock('@/lib/server/userTimeZone', () => ({ getUserTimeZone: async () => 'Africa/Cairo' }))
vi.mock('@/lib/server/userLocale', () => ({ getUserLocale: async () => 'en' }))
vi.mock('@/lib/server/sendNativePush', () => ({ sendNativePush: async () => ({ ok: true, sent: 1 }) }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: async () => {} }))
vi.mock('@/lib/server/realtime/nudge', () => ({ nudgeUser: async () => {} }))
vi.mock('@/lib/sms/aiUsage', () => ({ aiCallsToday: async () => 0 }))
vi.mock('@/lib/sms/curatedDbCache', () => ({ getCuratedDbTemplates: async () => [], TEMPLATE_COLUMNS: '*', invalidateCuratedDbCache: () => {} }))
vi.mock('@/lib/sms/correctionExemplar', () => ({ fetchCorrectionExemplar: async () => null }))
vi.mock('@/lib/server/ai/quota', () => ({ reserveAiQuota: async () => ({ allowed: true }), settleAiQuota: async () => {}, quotaDeniedResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/lib/sms/meteredAi', () => ({ withSmsAiQuota: async () => ({ denied: true }) }))
vi.mock('@/lib/sms/statsOutbox', () => ({ recordSmsStats: async () => {} }))
vi.mock('@/lib/sms/currencyResolver', () => ({ resolveCurrency: async () => ({ currency: 'EGP', provisional: false }) }))
vi.mock('@/lib/sms/negativeCache', async (orig) => ({ ...(await orig<typeof import('@/lib/sms/negativeCache')>()), isKnownNonTransaction: async () => false }))
vi.mock('@/lib/sms/patterns', async (orig) => ({ ...(await orig<typeof import('@/lib/sms/patterns')>()), matchCuratedPattern: () => h.curated }))
vi.mock('@/lib/sms/dispatch', async (orig) => ({ ...(await orig<typeof import('@/lib/sms/dispatch')>()), createSmsTransaction: h.dispatch }))

/** An in-memory log whose filters really filter and whose two partial unique indexes really refuse a second live row. */
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: async () => ({ data: true, error: null }),
    from: (name: string) => {
      const rows = (h.db[name] ??= [])
      const filters: Array<(r: Row) => boolean> = []
      let op: 'select' | 'insert' | 'update' = 'select'
      let payload: Row = {}
      let order: { col: string; asc: boolean } | null = null
      let max = Infinity
      const clash = (r: Row) => name === 'sms_parse_log' && rows.some((o) => o.user_id === r.user_id && !o.is_duplicate &&
        (o.sms_hash === r.sms_hash || (r.body_hash != null && r.captured_at != null && o.body_hash === r.body_hash && o.captured_at === r.captured_at)))
      const run = (): { data: Row[]; error: { code: string } | null } => {
        if (op === 'insert') {
          const row = { id: `${name}-${String(++h.seq).padStart(4, '0')}`, is_duplicate: false, deleted_at: null, ...payload }
          if (clash(row)) return { data: [], error: { code: '23505' } }
          rows.push(row)
          return { data: [row], error: null }
        }
        let hit = rows.filter((r) => filters.every((f) => f(r)))
        if (op === 'update') { hit.forEach((r) => Object.assign(r, payload)); return { data: hit, error: null } }
        if (order) { const { col, asc } = order; hit = [...hit].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)) }
        return { data: hit.slice(0, max), error: null }
      }
      const b: Record<string, unknown> = {
        select: () => b,
        insert: (p: Row) => ((op = 'insert'), (payload = p), b),
        update: (p: Row) => ((op = 'update'), (payload = p), b),
        upsert: (p: Row) => ((op = 'insert'), (payload = p), b),
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
        neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
        is: (c: string, v: unknown) => (filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
        not: (c: string, o: string, v: unknown) => (filters.push((r) => {
          if (o === 'in') return !String(v).slice(1, -1).split(',').includes(String(r[c]))
          return v === null ? r[c] != null : r[c] !== v
        }), b),
        in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
        gte: (c: string, v: string) => (filters.push((r) => r[c] != null && Date.parse(r[c] as string) >= Date.parse(v)), b),
        lte: (c: string, v: string) => (filters.push((r) => r[c] != null && Date.parse(r[c] as string) <= Date.parse(v)), b),
        order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), b),
        limit: (n: number) => ((max = n), b),
        or: () => b,
        maybeSingle: async () => { const r = run(); return { data: r.data[0] ?? null, error: r.error } },
        single: async () => { const r = run(); return { data: r.data[0] ?? null, error: r.error } },
        then: (res: (v: unknown) => unknown) => res(run()),
      }
      return b
    },
  }),
}))

import { POST } from './route'

const EVT = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NOW = '2026-10-27T12:00:00Z'
const DAY = 86_400_000
const PLAIN = 'Purchase of EGP 99.00 at Test Shop card ending 1234 at 10:15'
const WITH_REF = 'Transfer of EGP 99.00 to a friend, reference b3abc23f'
const WITH_BALANCE = 'Purchase of EGP 99.00 at Test Shop card ending 1234. Available balance EGP 4,201.50'

const curated = (extra: Record<string, unknown> = {}) => ({
  patternId: 'p1', paymentInstrument: 'card', txDay: null, amount: 99, currency: 'EGP', counterparty: 'Test Shop', bank: 'Test Bank',
  kind: 'purchase', cleanTitle: 'Test Shop', last4: '1234', counterpartyLast4: null, ...extra,
})

const post = (body: Record<string, unknown>) =>
  POST(new Request('http://x/api/sms/parse', { method: 'POST', body: JSON.stringify({ sender: 'TESTBANK', ...body }) }))
const logs = () => h.db.sms_parse_log ?? []
const claims = () => logs().filter((r) => r.user_id === 'u1')
const flagsOn = (logId: unknown) => (h.db.expenses ?? []).find((e) => e.sms_log_id === logId)?.sms_flags ?? null

beforeEach(() => {
  h.db = {}
  h.seq = 0
  h.curated = curated()
  h.dispatch.mockReset().mockImplementation(async (_s: unknown, input: Row) => {
    const expense = { id: `exp-${h.seq++}`, user_id: 'u1', sms_log_id: input.logId, sms_flags: (input.smsFlags as string[] | undefined) ?? null }
    ;(h.db.expenses ??= []).push(expense)
    return { outcome: 'posted', kind: 'purchase', expenseId: expense.id, incomeId: null, debtPaymentId: null, category: null, confirmReason: null, matchedSourceId: null, linkedSubscriptionId: null, error: null }
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  process.env.GEMINI_API_KEY = ''
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('I5 rule 1: the same capture is never booked twice', () => {
  it('refuses the same text and capture second sent under a new capture id three days later', async () => {
    const first = await (await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00+03:00', eventId: EVT(1) })).json()
    expect(first.ok).toBe(true)
    vi.setSystemTime(new Date(Date.parse(NOW) + 3 * DAY))
    const second = await (await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00.400+03:00', eventId: EVT(2) })).json()
    expect(second).toMatchObject({ ok: true, duplicate: true, expenseId: first.expenseId })
    expect(h.dispatch).toHaveBeenCalledTimes(1)
    expect(claims().filter((r) => !r.is_duplicate)).toHaveLength(1)
  })

  it('writes body_hash and the client capture second, and null captured_at when the client sent no time', async () => {
    await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00.987+03:00', eventId: EVT(1) })
    await post({ message: 'Another text with no time', eventId: EVT(2) })
    const [a, b] = claims()
    expect(a.captured_at).toBe('2026-10-27T07:00:00.000Z')
    expect(a.body_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(b.captured_at).toBeNull()
  })

  it('with no client time, rule 1 never fires: the same text under a new id is processed', async () => {
    await post({ message: PLAIN, eventId: EVT(1) })
    vi.setSystemTime(new Date(Date.parse(NOW) + 3 * DAY))
    const second = await (await post({ message: PLAIN, eventId: EVT(2) })).json()
    expect(second.duplicate).toBeUndefined()
    expect(h.dispatch).toHaveBeenCalledTimes(2)
  })

  it('processes four identical texts on four consecutive days with no guard firing', async () => {
    for (let d = 0; d < 4; d++) {
      vi.setSystemTime(new Date(Date.parse(NOW) + d * DAY))
      const res = await (await post({ message: PLAIN, receivedAt: new Date(Date.parse(NOW) + d * DAY - 3_600_000).toISOString(), eventId: EVT(10 + d) })).json()
      expect(res.duplicate).toBeUndefined()
    }
    expect(h.dispatch).toHaveBeenCalledTimes(4)
    for (const call of h.dispatch.mock.calls) expect(call[1].smsFlags).toBeUndefined()
  })
})

describe('I5 rule 3: a possible second copy', () => {
  const at = (s: number) => new Date(Date.parse('2026-10-27T09:00:00Z') + s * 1000).toISOString()

  it('marks the later copy a duplicate when the text carries a payment reference', async () => {
    const first = await (await post({ message: WITH_REF, receivedAt: at(0), eventId: EVT(1) })).json()
    const second = await (await post({ message: WITH_REF, receivedAt: at(40), eventId: EVT(2) })).json()
    expect(second).toMatchObject({ ok: true, duplicate: true, expenseId: first.expenseId })
    expect(h.dispatch).toHaveBeenCalledTimes(1)
    expect(claims()[1]).toMatchObject({ is_duplicate: true, status: 'rejected', failure_code: 'duplicate_capture' })
  })

  it('marks the later copy a duplicate when the text carries a running balance', async () => {
    await post({ message: WITH_BALANCE, receivedAt: at(0), eventId: EVT(1) })
    const second = await (await post({ message: WITH_BALANCE, receivedAt: at(40), eventId: EVT(2) })).json()
    expect(second.duplicate).toBe(true)
    expect(h.dispatch).toHaveBeenCalledTimes(1)
  })

  it('books both when only a time of day is printed, and flags only the later one', async () => {
    await post({ message: PLAIN, receivedAt: at(0), eventId: EVT(1) })
    await post({ message: PLAIN, receivedAt: at(40), eventId: EVT(2) })
    expect(h.dispatch).toHaveBeenCalledTimes(2)
    const [early, late] = claims()
    expect(flagsOn(early.id)).toBeNull()
    expect(flagsOn(late.id)).toEqual(['possible_duplicate'])
    expect(h.dispatch.mock.calls[0][1].smsFlags).toBeUndefined()
    expect(h.dispatch.mock.calls[1][1].smsFlags).toEqual(['possible_duplicate'])
  })

  it('stamps the flag after the dispatcher when the dispatcher path could not take it with the insert', async () => {
    h.dispatch.mockImplementation(async (_s: unknown, input: Row) => {
      ;(h.db.expenses ??= []).push({ id: `exp-${h.seq++}`, user_id: 'u1', sms_log_id: input.logId, sms_flags: null })
      return { outcome: 'posted', kind: 'purchase', expenseId: 'x', incomeId: null, debtPaymentId: null, category: null, confirmReason: null, matchedSourceId: null, linkedSubscriptionId: null, error: null }
    })
    await post({ message: PLAIN, receivedAt: at(0), eventId: EVT(1) })
    await post({ message: PLAIN, receivedAt: at(40), eventId: EVT(2) })
    expect(flagsOn(claims()[1].id)).toEqual(['possible_duplicate'])
    expect(flagsOn(claims()[0].id)).toBeNull()
  })

  it('answers in progress, and retires its own claim, when the earlier copy is still processing', async () => {
    h.db.sms_parse_log = [{ id: 'early', user_id: 'u1', status: 'processing', is_duplicate: false, body_hash: null, captured_at: null, received_at: at(0), sms_hash: 'h0', expense_id: null, income_id: null }]
    const { computeBodyHash } = await import('@/lib/sms/ingestGuards')
    h.db.sms_parse_log[0].body_hash = computeBodyHash(WITH_REF)
    const res = await post({ message: WITH_REF, receivedAt: at(40), eventId: EVT(2) })
    expect(res.status).toBe(409)
    expect(claims().find((r) => r.id !== 'early')).toMatchObject({ is_duplicate: true })
    expect(h.dispatch).not.toHaveBeenCalled()
  })

  it('the copy captured later is booked first: the earlier capture arriving second is a duplicate when the text carries a reference', async () => {
    const first = await (await post({ message: WITH_REF, receivedAt: at(40), eventId: EVT(1) })).json()
    const second = await (await post({ message: WITH_REF, receivedAt: at(0), eventId: EVT(2) })).json()
    expect(second).toMatchObject({ ok: true, duplicate: true, expenseId: first.expenseId })
    expect(h.dispatch).toHaveBeenCalledTimes(1)
  })

  it('the copy captured later is booked first: the earlier capture arriving second is booked and flagged, the first untouched', async () => {
    await post({ message: PLAIN, receivedAt: at(40), eventId: EVT(1) })
    await post({ message: PLAIN, receivedAt: at(0), eventId: EVT(2) })
    expect(h.dispatch).toHaveBeenCalledTimes(2)
    const [first, second] = claims()
    expect(flagsOn(first.id)).toBeNull()
    expect(flagsOn(second.id)).toEqual(['possible_duplicate'])
  })

  it('two requests at the same instant with different ids: exactly one is the later copy', async () => {
    await Promise.all([post({ message: PLAIN, eventId: EVT(1) }), post({ message: PLAIN, eventId: EVT(2) })])
    const flagged = claims().filter((r) => flagsOn(r.id) !== null)
    expect(h.dispatch).toHaveBeenCalledTimes(2)
    expect(flagged).toHaveLength(1)
  })
})

describe('I6: dates never reject', () => {
  it('books on the capture day, flagged, when the body carries a year far in the future', async () => {
    h.curated = curated({ txDay: '2090-01-14' })
    const res = await (await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00+03:00', eventId: EVT(1) })).json()
    expect(res).toMatchObject({ ok: true, autoAdded: true })
    expect(h.dispatch.mock.calls[0][1]).toMatchObject({ day: '2026-10-27', smsFlags: ['date_unsure'] })
    expect(flagsOn(claims()[0].id)).toEqual(['date_unsure'])
  })

  it('books on the server arrival day, flagged, for an undated body and a client clock three years behind', async () => {
    const res = await (await post({ message: PLAIN, receivedAt: '2023-10-27T10:00:00+03:00', eventId: EVT(1) })).json()
    expect(res).toMatchObject({ ok: true, autoAdded: true })
    expect(h.dispatch.mock.calls[0][1]).toMatchObject({ day: '2026-10-27', smsFlags: ['date_unsure'] })
  })

  it('uses a plausible body date with no flag', async () => {
    h.curated = curated({ txDay: '2026-10-25' })
    await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00+03:00', eventId: EVT(1) })
    expect(h.dispatch.mock.calls[0][1].day).toBe('2026-10-25')
    expect(h.dispatch.mock.calls[0][1].smsFlags).toBeUndefined()
  })
})

describe('I6: an amount that cannot be booked is held, never answered as success and forgotten', () => {
  it.each([
    ['a zero amount', 0, 'null_amount'],
    ['an absurd amount', 5_000_000_000, 'implausible_amount'],
    ['a negative amount', -40, 'implausible_amount'],
  ])('holds %s for review', async (_label, amount, code) => {
    h.curated = curated({ amount })
    const res = await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00+03:00', eventId: EVT(1) })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, held: true, reason: code })
    expect(claims()[0]).toMatchObject({ parsed_ok: true, awaiting_confirmation: true, status: 'logged', failure_code: code, amount: null })
    expect(h.dispatch).not.toHaveBeenCalled()
  })

  it('holds a transaction below the confidence floor with its amount, so the list can show it', async () => {
    h.curated = null
    process.env.GEMINI_API_KEY = 'k'
    const ai = { is_transaction: true, amount: 99, currency: 'EGP', merchant: 'Test Shop', bank_name: 'Test Bank', category: null, confidence: 0.4, kind: 'purchase', cleanTitle: 'Test Shop', detectedAccountLast4: null, detectedCounterpartyLast4: null, merchantNormalized: null }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(ai) }] } }] }) })))
    const res = await post({ message: PLAIN, receivedAt: '2026-10-27T10:00:00+03:00', eventId: EVT(1) })
    expect(await res.json()).toMatchObject({ ok: true, held: true, reason: 'low_confidence' })
    expect(claims()[0]).toMatchObject({ parsed_ok: true, awaiting_confirmation: true, failure_code: 'low_confidence', amount: 99, currency: 'EGP', kind: 'purchase' })
    expect(h.dispatch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
