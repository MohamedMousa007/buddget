import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

vi.mock('server-only', () => ({}))

import { MissingVariablesError, renderEmail } from './render'
import { invalidateTemplate } from './store'
import { verifySignedWebhook } from './webhook'

type Row = { subject: string; preheader: string; html: string } | null

function fakeService(rows: Record<string, Row>) {
  const calls: string[] = []
  const service = {
    from: () => {
      const f: Record<string, string> = {}
      const q = {
        select: () => q,
        eq: (c: string, v: string) => ((f[c] = v), q),
        maybeSingle: async () => {
          calls.push(`${f.key}:${f.locale}`)
          return { data: rows[`${f.key}:${f.locale}`] ?? null, error: null }
        },
      }
      return q
    },
  }
  return { service: service as never, calls }
}

beforeEach(() => ['sign_in_code', 'welcome', 'reauthentication'].forEach(invalidateTemplate))

describe('renderEmail', () => {
  it('uses the published template and HTML-escapes the values', async () => {
    const { service } = fakeService({ 'sign_in_code:en': { subject: 'Code {{code}}', preheader: 'p', html: '<body><p>{{first_name}} {{code}}</p></body>' } })
    const r = await renderEmail(service, 'sign_in_code', 'en', { code: '1<2', first_name: '<b>Sara</b>' })
    expect(r.origin).toBe('database')
    expect(r.html).toContain('&lt;b&gt;Sara&lt;/b&gt; 1&lt;2')
    expect(r.subject).toBe('Code 1<2')
  })
  it('falls back to the compiled copy when the row is missing', async () => {
    const { service } = fakeService({})
    const r = await renderEmail(service, 'welcome', 'ar', { first_name: 'سارة' })
    expect(r.origin).toBe('builtin')
    expect(r.locale).toBe('ar')
    expect(r.html).toContain('dir="rtl"')
    expect(r.html).toContain('سارة')
  })
  it('falls back when a bad edit references a variable nobody supplies', async () => {
    const { service } = fakeService({ 'welcome:en': { subject: 's', preheader: '', html: '<p>{{inviter_name}}</p>' } })
    const r = await renderEmail(service, 'welcome', 'en', {})
    expect(r.origin).toBe('builtin')
    expect(r.html).not.toContain('inviter_name')
  })
  it('uses the English row when the Arabic one is missing', async () => {
    const { service } = fakeService({ 'welcome:en': { subject: 'Hello', preheader: '', html: '<p>hi</p>' } })
    const r = await renderEmail(service, 'welcome', 'ar', {})
    expect(r).toMatchObject({ origin: 'database', locale: 'en', subject: 'Hello' })
  })
  it('throws when the sender omits a variable the scenario requires', async () => {
    const { service } = fakeService({})
    await expect(renderEmail(service, 'reauthentication', 'en', {})).rejects.toBeInstanceOf(MissingVariablesError)
  })
  it('caches the published row until invalidated', async () => {
    const { service, calls } = fakeService({})
    await renderEmail(service, 'welcome', 'en', {})
    await renderEmail(service, 'welcome', 'en', {})
    expect(calls.filter((c) => c === 'welcome:en')).toHaveLength(1)
    invalidateTemplate('welcome')
    await renderEmail(service, 'welcome', 'en', {})
    expect(calls.filter((c) => c === 'welcome:en')).toHaveLength(2)
  })
})

describe('verifySignedWebhook', () => {
  const secret = `whsec_${Buffer.from('shh').toString('base64')}`
  const sign = (id: string, ts: string, body: string) => `v1,${createHmac('sha256', Buffer.from('shh')).update(`${id}.${ts}.${body}`).digest('base64')}`
  const now = 1_800_000_000
  it('accepts a good signature and rejects tampering, stale timestamps and missing headers', () => {
    const ts = String(now)
    const sig = sign('m1', ts, '{"a":1}')
    expect(verifySignedWebhook({ id: 'm1', timestamp: ts, signature: sig }, '{"a":1}', secret, now)).toBe(true)
    expect(verifySignedWebhook({ id: 'm1', timestamp: ts, signature: `v1,bogus ${sig}` }, '{"a":1}', secret, now)).toBe(true)
    expect(verifySignedWebhook({ id: 'm1', timestamp: ts, signature: sig }, '{"a":2}', secret, now)).toBe(false)
    expect(verifySignedWebhook({ id: 'm1', timestamp: ts, signature: sig }, '{"a":1}', secret, now + 1000)).toBe(false)
    expect(verifySignedWebhook({ id: null, timestamp: ts, signature: sig }, '{"a":1}', secret, now)).toBe(false)
  })
})
