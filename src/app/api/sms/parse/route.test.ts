import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeLegacySmsHashes, computeSmsHash } from '@/lib/sms/ingestGuards'

type Op = { table: string; op: string; values?: Record<string, unknown>; filters: Array<[string, unknown]> }

const h = vi.hoisted(() => ({
  ops: [] as Array<{ table: string; op: string; values?: Record<string, unknown>; filters: Array<[string, unknown]> }>,
  afters: [] as Array<() => unknown>,
  siblings: [] as Array<Record<string, unknown>>,
  neighbourRows: [] as Array<Record<string, unknown>>,
  geminiRegexOk: false,
  learnGates: vi.fn(),
  loadReplay: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => { h.afters.push(fn) } }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/sms/resolveSmsUser', () => ({ resolveSmsCaller: async () => ({ userId: 'u1', deviceId: null }) }))
vi.mock('@/lib/sms/deviceGate', () => ({ smsDeviceGate: async () => null }))
vi.mock('@/lib/server/userTimeZone', () => ({ getUserTimeZone: async () => 'Africa/Cairo' }))
vi.mock('@/lib/sms/curatedDbCache', () => ({ getCuratedDbTemplates: async () => [], TEMPLATE_COLUMNS: '*', invalidateCuratedDbCache: () => {} }))
vi.mock('@/lib/sms/correctionExemplar', () => ({ fetchCorrectionExemplar: async () => null }))
vi.mock('@/lib/server/ai/quota', () => ({ reserveAiQuota: async () => ({ allowed: true }), settleAiQuota: async () => {}, quotaDeniedResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/lib/sms/meteredAi', () => ({ withSmsAiQuota: async (_u: string, _n: number, _m: string, call: () => Promise<unknown>) => ({ denied: false, value: await call() }) }))
vi.mock('@/lib/sms/replayLoader', () => ({ loadReplayCases: h.loadReplay }))
vi.mock('@/lib/sms/learnGates', () => ({ runLearnGates: h.learnGates }))
vi.mock('@/lib/sms/promotionChecker', () => ({ checkAndAutoPromote: async () => {} }))
vi.mock('@/lib/sms/statsOutbox', () => ({ recordSmsStats: async () => {} }))
vi.mock('@/lib/sms/dispatch', () => ({ createSmsTransaction: async () => { throw new Error('stop here') } }))
vi.mock('@/lib/sms/currencyResolver', () => ({ resolveCurrency: async () => ({ currency: 'EGP', provisional: false }) }))
vi.mock('@/lib/sms/runAdjudication', () => ({ runAdjudication: async () => ({ adjudicated: 0, counted: 0 }) }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: async () => ({ data: [], error: null }),
    from: (table: string) => {
      const rec: Op = { table, op: 'select', filters: [] }
      const result = () => {
        if (table === 'sms_parse_log' && rec.op === 'select' && rec.filters.some(([k]) => k === 'in:sms_hash')) return { data: h.neighbourRows, error: null }
        if (table === 'sms_tracking_templates_ai' && rec.op === 'select' && rec.filters.some(([k, v]) => k === 'eq:sender' && v === 'TESTBANK')) return { data: h.siblings, error: null }
        return { data: [], error: null }
      }
      const q: Record<string, unknown> = {}
      const chain = (name: string) => (col: string, val: unknown) => { rec.filters.push([`${name}:${col}`, val]); return q }
      for (const m of ['select', 'is', 'not', 'neq', 'order', 'limit', 'or', 'gte', 'lte']) q[m] = (..._a: unknown[]) => q
      q.eq = chain('eq'); q.in = chain('in')
      q.insert = (values: Record<string, unknown>) => { rec.op = 'insert'; rec.values = values; h.ops.push(rec); return q }
      q.update = (values: Record<string, unknown>) => { rec.op = 'update'; rec.values = values; h.ops.push(rec); return q }
      q.upsert = q.insert
      q.single = async () => (rec.op === 'insert' && table === 'sms_parse_log' ? { data: { id: 'log-1' }, error: null } : { data: null, error: null })
      q.maybeSingle = async () => ({ data: null, error: null })
      q.then = (res: (v: unknown) => unknown) => { if (!h.ops.includes(rec)) h.ops.push(rec); return res(result()) }
      return q
    },
  }),
}))

import { POST } from './route'

const NEUTRAL = 'Purchase of 120.50 EGP at Test Shop card ending 1234'
const RECEIVED = '2026-10-01T10:00:00+03:00'
const post = (body: Record<string, unknown>) =>
  POST(new Request('http://x/api/sms/parse', { method: 'POST', body: JSON.stringify(body) }))
const geminiJson = (obj: unknown) => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) })
const learnUpdates = () => h.ops.filter((o) => o.table === 'sms_parse_log' && o.op === 'update' && o.values && 'learn_status' in o.values).map((o) => o.values!.learn_status)

beforeEach(() => {
  h.ops.length = 0; h.afters.length = 0; h.siblings = []; h.neighbourRows = []
  h.learnGates.mockReset().mockReturnValue({ ok: false, status: 'gate_stub' })
  h.loadReplay.mockReset().mockResolvedValue([])
  process.env.GEMINI_API_KEY = 'test-key'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('POST /api/sms/parse wiring', () => {
  it('claims the row under the hash of the RAW message and looks for neighbour and legacy hashes', async () => {
    h.neighbourRows = [{ expense_id: 'e1', income_id: null, status: 'confirmed', parsed_at: new Date().toISOString() }]
    const res = await post({ message: NEUTRAL, sender: 'TESTBANK', receivedAt: RECEIVED })
    expect((await res.json()).duplicate).toBe(true)
    const lookup = h.ops.find((o) => o.filters.some(([k]) => k === 'in:sms_hash'))!
    const searched = lookup.filters.find(([k]) => k === 'in:sms_hash')![1] as string[]
    for (const legacy of computeLegacySmsHashes(NEUTRAL, RECEIVED)) expect(searched).toContain(legacy)
    expect(searched).not.toContain(computeSmsHash(NEUTRAL, RECEIVED))
  })

  it('stores the claim under computeSmsHash of the raw text', async () => {
    const res = await post({ message: NEUTRAL, sender: 'TESTBANK', receivedAt: RECEIVED })
    expect(res.status).toBeGreaterThanOrEqual(200)
    const claim = h.ops.find((o) => o.table === 'sms_parse_log' && o.op === 'insert')!
    expect(claim.values!.sms_hash).toBe(computeSmsHash(NEUTRAL, RECEIVED))
  })

  it('answers a pre-filter rejection with its reason and keeps the row out of the AI path', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await post({ message: 'Your verification code is 123456. Do not share it.', sender: 'TESTBANK', receivedAt: RECEIVED })
    const body = await res.json()
    expect(body).toMatchObject({ ok: false, reason: 'not_transaction', rejected: 'otp' })
    expect(fetchMock).not.toHaveBeenCalled()
    const claimed = h.ops.find((o) => o.table === 'sms_parse_log' && o.op === 'insert')!
    expect(String(claimed.values!.raw_body)).not.toContain('123456')
    const reject = h.ops.find((o) => o.op === 'update' && o.values?.failure_code === 'not_transaction')!
    expect(String(reject.values!.raw_body)).not.toContain('123456')
  })
})

describe('AI-learning hooks', () => {
  const aiParse = { is_transaction: true, amount: 120.5, currency: 'EGP', merchant: 'Test Shop', bank_name: 'Test Bank', category: null, confidence: 0.95, kind: 'purchase', cleanTitle: 'Test Shop', detectedAccountLast4: '1234', detectedCounterpartyLast4: null, merchantNormalized: null }
  const runLearn = async (regexResponse: unknown) => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) =>
      init.body.includes('regex_pattern') ? regexResponse : geminiJson(aiParse)))
    await post({ message: NEUTRAL, sender: 'TESTBANK', receivedAt: RECEIVED })
    for (const fn of h.afters) await fn()
  }

  it('passes the SMS receive time and the replay cases to the learn gates', async () => {
    h.loadReplay.mockResolvedValue([{ id: 'c1', body: 'x', expect: { matches: false } }])
    await runLearn(geminiJson({ regex_pattern: 'Purchase of (\\d+\\.\\d+) EGP', mapping_rules: { amount: { group: 1 } } }))
    expect(h.learnGates).toHaveBeenCalled()
    const opts = h.learnGates.mock.calls[0][4]
    expect(opts).toMatchObject({ receivedAt: RECEIVED })
    expect(opts.replay).toHaveLength(1)
    expect(h.loadReplay.mock.calls[0][1]).toBe('TESTBANK')
  })

  it('stores a failed learn as <class>#<attempt>|<reason>', async () => {
    await runLearn({ ok: false, status: 500, text: async () => '', json: async () => ({}) })
    expect(learnUpdates().at(-1)).toMatch(/^[a-z_]+#1\|gemini_error$/)
  })

  it('refuses a new template once the sender has a full set of live ones, ignoring retired ones', async () => {
    h.learnGates.mockReturnValue({ ok: true })
    h.siblings = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, status: 'active', regex_pattern: `r${i}`, template_sample: null, mapping_rules: {} })),
      { id: 'dead', status: 'retired', regex_pattern: 'rx', template_sample: null, mapping_rules: {} },
    ]
    await runLearn(geminiJson({ regex_pattern: 'Purchase of (\\d+\\.\\d+) EGP', mapping_rules: { amount: { group: 1 } } }))
    expect(learnUpdates().at(-1)).toBe('cap_reached')
    expect(h.ops.some((o) => o.table === 'sms_tracking_templates_ai' && o.op === 'insert')).toBe(false)
  })
})
