import { describe, it, expect, vi } from 'vitest'

const captureException = vi.fn(() => 'evt-1')
vi.mock('@sentry/capacitor', () => ({ init: vi.fn(), setTag: vi.fn(), setUser: vi.fn() }))
vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }))
vi.mock('@/lib/native/deviceId', () => ({ getOrCreateDeviceId: vi.fn(async () => null) }))

describe('crash init queue', () => {
  it('holds errors raised before Sentry loads and flushes them after init', async () => {
    vi.stubGlobal('window', {})
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://k@example.com/1')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DEV', '1')
    const crash = await import('./init')
    crash.initCrashReporting()
    expect(crash.captureAppError(new Error('early'), 'boot')).toBeUndefined()
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
    expect(crash.captureAppError(new Error('live'), 'x')).toBe('evt-1')
  })
})
