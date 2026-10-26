import { describe, it, expect, vi } from 'vitest'

const loaded = vi.fn()
vi.mock('@sentry/capacitor', () => {
  loaded('capacitor')
  return { init: vi.fn(), setTag: vi.fn(), setUser: vi.fn() }
})
vi.mock('@sentry/react', () => {
  loaded('react')
  return { init: vi.fn(), captureException: vi.fn() }
})

describe('crash init', () => {
  it('does not load Sentry when the guards stop reporting', async () => {
    const crash = await import('./init')
    crash.initCrashReporting()
    crash.setCrashUser('u1')
    expect(crash.captureAppError(new Error('x'), 'test')).toBeUndefined()
    expect(loaded).not.toHaveBeenCalled()
  })
})
