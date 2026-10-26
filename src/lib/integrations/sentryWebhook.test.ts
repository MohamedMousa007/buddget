import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseCrashEvent, validSignature } from './sentryWebhook'

describe('validSignature', () => {
  const raw = '{"a":1}'
  const sig = createHmac('sha256', 'secret').update(raw).digest('hex')
  it('accepts the right signature only', () => {
    expect(validSignature(raw, sig, 'secret')).toBe(true)
    expect(validSignature(raw, sig, 'other')).toBe(false)
    expect(validSignature('{"a":2}', sig, 'secret')).toBe(false)
    expect(validSignature(raw, null, 'secret')).toBe(false)
    expect(validSignature(raw, 'zz', 'secret')).toBe(false)
  })
})

describe('parseCrashEvent', () => {
  const event = {
    title: 'TypeError: x is undefined',
    culprit: 'App.tsx',
    level: 'fatal',
    release: 'buddget@1.1.0',
    issue_id: 4521,
    web_url: 'https://sentry.io/issues/4521/',
    tags: [['platform', 'ios'], ['build', '128'], ['device_id', 'dev-1']],
    user: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
    datetime: '2026-10-26T10:00:00Z',
    exception: { values: [{ type: 'TypeError', value: 'x is undefined', stacktrace: { frames: [{ function: 'a', filename: 'a.js', lineno: 1 }, { function: 'b', filename: 'b.js', lineno: 2 }] } }] },
  }
  it('maps an issue alert event to a crash row', () => {
    const c = parseCrashEvent({ data: { event } })
    expect(c).toMatchObject({ fingerprint: '4521', release: 'buddget@1.1.0', level: 'fatal', platform: 'ios', build: '128', deviceId: 'dev-1', userId: event.user.id, url: 'https://sentry.io/issues/4521/' })
    expect(c?.stack).toBe('TypeError: x is undefined\n  at b (b.js:2)\n  at a (a.js:1)')
  })
  it('ignores non-uuid users, unknown levels and bodies without an event', () => {
    expect(parseCrashEvent({ data: { event: { ...event, user: { id: 'someone' }, level: 'weird' } } })).toMatchObject({ userId: null, level: 'error' })
    expect(parseCrashEvent({ data: {} })).toBeNull()
    expect(parseCrashEvent(null)).toBeNull()
  })
})
