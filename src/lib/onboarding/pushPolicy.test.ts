import { describe, expect, it } from 'vitest'
import { deferPushPrompt } from './pushPolicy'

const NOW = Date.parse('2026-11-20T10:00:00Z')
const base = { v: 1 as const, step: 4, startedAt: '2026-11-01T10:00:00Z' }

describe('deferPushPrompt', () => {
  it('holds the prompt while the journey is open, so it is asked with context', () => {
    expect(deferPushPrompt(base, true, NOW)).toBe(true)
  })
  it('leaves established accounts exactly as before', () => {
    expect(deferPushPrompt(undefined, false, NOW)).toBe(false)
    expect(deferPushPrompt({ ...base, doneAt: '2026-11-02T10:00:00Z', push: 'allowed' }, false, NOW)).toBe(false)
  })
  it('respects a recent "not now" and asks again after a month', () => {
    expect(deferPushPrompt({ ...base, push: 'later', pushLaterAt: '2026-11-10T10:00:00Z' }, false, NOW)).toBe(true)
    expect(deferPushPrompt({ ...base, push: 'later', pushLaterAt: '2026-10-10T10:00:00Z' }, false, NOW)).toBe(false)
  })
})
