import { describe, expect, it } from 'vitest'
import { sanitizeMeta } from './events'

describe('sanitizeMeta', () => {
  it('accepts exactly what the client sends and nothing more', () => {
    expect(sanitizeMeta('onboarding_step_view', { step: 'goals', extra: 'x' })).toEqual({ step: 'goals' })
    expect(sanitizeMeta('onboarding_permission', { kind: 'push', granted: false, junk: 1 })).toEqual({ kind: 'push', granted: false })
    expect(sanitizeMeta('onboarding_completed', { budget: true })).toEqual({ budget: true })
    expect(sanitizeMeta('onboarding_skipped', { step: 3 })).toEqual({ step: 3 })
    expect(sanitizeMeta('onboarding_started', { anything: 1 })).toEqual({})
  })
  it('refuses values that would break the funnel query', () => {
    expect(sanitizeMeta('onboarding_permission', { kind: 'push', granted: 'abc' })).toBeNull()
    expect(sanitizeMeta('onboarding_permission', { kind: 'camera', granted: true })).toBeNull()
    expect(sanitizeMeta('onboarding_step_view', { step: 'nope' })).toBeNull()
    expect(sanitizeMeta('onboarding_step_complete', {})).toBeNull()
  })
  it('drops a malformed optional value instead of refusing the event', () => {
    expect(sanitizeMeta('onboarding_completed', { budget: 'yes' })).toEqual({})
    expect(sanitizeMeta('onboarding_skipped', { step: 99 })).toEqual({})
  })
})
