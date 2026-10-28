import { describe, expect, it } from 'vitest'
import { deferPushPrompt, pushBootAction } from './pushPolicy'

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

describe('pushBootAction', () => {
  it('never shows the OS dialog cold: a phone that was not asked gets the pre-prompt first', () => {
    expect(pushBootAction('prompt', undefined, false, false, NOW)).toBe('ask')
  })
  it('registers silently once the OS permission is already granted', () => {
    expect(pushBootAction('granted', undefined, false, false, NOW)).toBe('register')
  })
  it('leaves a denied phone and an opted-out account alone', () => {
    expect(pushBootAction('denied', undefined, false, false, NOW)).toBe('skip')
    expect(pushBootAction('granted', undefined, false, true, NOW)).toBe('skip')
  })
  it('holds the pre-prompt while the journey is open and after a recent "not now"', () => {
    expect(pushBootAction('prompt', base, true, false, NOW)).toBe('skip')
    expect(pushBootAction('prompt', { ...base, push: 'later', pushLaterAt: '2026-11-10T10:00:00Z' }, false, false, NOW)).toBe('skip')
  })
})
